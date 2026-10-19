"use strict";
/* FlowPilot enquiry capture — Node.js implementation of the contact API.
   Replaces api/contact.php (PHP does not run on the GoDaddy Node.js host).

   POST /api/contact   (POST /api/contact.php is aliased by server.js for
                        visitors still running a cached older script)
   Body: JSON or form-encoded
     { name, business?, email, phone?, topic?, message, "company-website"? (honeypot) }

   Responses are JSON only: {"ok":true} or {"ok":false,"error":"<generic>"}.
   Responses and logs never contain credentials, stack traces, or enquiry
   content. Enquiries are stored via the pool returned by options.getPool()
   (mysql2) using prepared statements. */

const crypto = require("crypto");
const net = require("net");
const querystring = require("querystring");

const MAX_BODY_BYTES = 32 * 1024;          // body cap; oversized → 413
const MAX_ENQUIRIES_PER_10_MIN = 5;        // per hashed IP, same as the PHP endpoint

const COUNT_SQL =
  "SELECT COUNT(*) AS n FROM enquiries WHERE ip_hash = ? AND submitted_at > (NOW() - INTERVAL 10 MINUTE)";
const INSERT_SQL =
  "INSERT INTO enquiries (name, business, email, phone, topic, message, ip_hash, user_agent) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

/* Peers on loopback/private addresses are reverse proxies in front of this
   process (GoDaddy terminates requests in a local proxy). Only then is the
   X-Forwarded-For header trusted; direct public peers are used as-is, so an
   attacker cannot rotate their apparent IP by spoofing the header. */
const PRIVATE_PEER_RE = new RegExp(
  "^(::1|127\\.|::ffff:127\\.|10\\.|::ffff:10\\.|192\\.168\\.|::ffff:192\\.168\\.|" +
  "172\\.(1[6-9]|2[0-9]|3[01])\\.|::ffff:172\\.(1[6-9]|2[0-9]|3[01])\\.|f[cd][0-9a-f]{2}:|fe80:)",
  "i"
);

module.exports = function createContactHandler(options) {
  options = options || {};
  const getPool = typeof options.getPool === "function" ? options.getPool : function () { return null; };
  const ipSalt = typeof options.ipSalt === "string" ? options.ipSalt : "";
  const notify = typeof options.notify === "function" ? options.notify : null;
  const allowedOrigins = Array.isArray(options.allowedOrigins) ? options.allowedOrigins : [];
  const log = options.log || console;

  const logInfo = function (msg) { if (typeof log.info === "function") log.info(msg); else console.log(msg); };
  const logError = function (msg) { if (typeof log.error === "function") log.error(msg); else console.error(msg); };

  function sendJson(res, status, obj, corsOrigin, allow) {
    if (res.headersSent) return;
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    };
    if (allow) headers["Allow"] = allow;
    if (corsOrigin) {
      headers["Access-Control-Allow-Origin"] = corsOrigin;
      headers["Vary"] = "Origin";
    }
    res.writeHead(status, headers);
    res.end(JSON.stringify(obj));
  }

  function readBody(req, maxBytes, cb) {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on("data", function (chunk) {
      if (done) return;
      size += chunk.length;
      if (size > maxBytes) {
        done = true;
        cb("too_large", null);
        req.resume(); // drain the rest so the socket can close cleanly
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (!done) { done = true; cb(null, Buffer.concat(chunks).toString("utf8")); }
    });
    req.on("error", function () {
      if (!done) { done = true; cb("read_error", null); }
    });
  }

  /* querystring.parse can yield arrays for repeated keys — always take a scalar. */
  function fieldValue(data, key) {
    const v = data[key];
    if (v == null) return "";
    if (Array.isArray(v)) return v.length ? String(v[0] == null ? "" : v[0]) : "";
    return String(v);
  }

  function stripTags(s) { return s.replace(/<[^>]*>/g, ""); }

  /* Same limits as api/contact.php. Returns a clean record or null. */
  function normalize(data) {
    const controlExceptNewline = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
    const allControl = /[\x00-\x1F\x7F]+/g;

    const name = stripTags(fieldValue(data, "name")).replace(allControl, " ").trim();
    const business = stripTags(fieldValue(data, "business")).replace(allControl, " ").trim();
    const email = fieldValue(data, "email").replace(allControl, " ").trim();
    const phone = fieldValue(data, "phone").replace(allControl, " ").trim();
    const topic = stripTags(fieldValue(data, "topic")).replace(allControl, " ").trim();
    let message = stripTags(fieldValue(data, "message"))
      .replace(controlExceptNewline, "")
      .replace(/\r\n?/g, "\n")
      .trim();

    /* RFC-lite email check + explicit rejection of header-unsafe characters,
       since the address is later used as the SMTP Reply-To. */
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || name.length > 120) return null;
    if (business.length > 160) return null;
    if (!email || email.length > 190 || !EMAIL_RE.test(email) || /[\r\n<>]/.test(email)) return null;
    if (phone.length > 40) return null;
    if (topic.length > 80) return null;
    if (!message || message.length > 5000) return null;

    return { name: name, business: business, email: email, phone: phone, topic: topic, message: message };
  }

  function clientIp(req) {
    const remote = (req.socket && req.socket.remoteAddress) || "";
    if (remote && PRIVATE_PEER_RE.test(remote)) {
      const xff = req.headers["x-forwarded-for"];
      if (typeof xff === "string" && xff.length > 0) {
        const first = xff.split(",")[0].trim();
        if (first && first.length <= 45 && net.isIP(first)) return first.replace(/^::ffff:/, "");
      }
    }
    return remote.replace(/^::ffff:/, "");
  }

  function hashIp(ip, salt) {
    return crypto.createHash("sha256").update(String(ip) + "|" + String(salt)).digest("hex");
  }

  function countFromResult(result) {
    const rows = Array.isArray(result) ? result[0] : result;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return 0;
    const n = row.n != null ? row.n : (row["COUNT(*)"] != null ? row["COUNT(*)"] : 0);
    return parseInt(n, 10) || 0;
  }

  return function contactHandler(req, res) {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    const corsOrigin = allowedOrigins.indexOf(origin) !== -1 ? origin : "";

    if (req.method === "OPTIONS") {
      const headers = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        "Content-Length": "0"
      };
      if (corsOrigin) {
        headers["Access-Control-Allow-Origin"] = corsOrigin;
        headers["Vary"] = "Origin";
      }
      res.writeHead(204, headers);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" }, corsOrigin, "POST, OPTIONS");
      return;
    }

    readBody(req, MAX_BODY_BYTES, function (err, raw) {
      if (err === "too_large") {
        sendJson(res, 413, { ok: false, error: "Payload too large" }, corsOrigin);
        return;
      }
      if (err) {
        sendJson(res, 400, { ok: false, error: "Invalid request body" }, corsOrigin);
        return;
      }

      const ctype = String(req.headers["content-type"] || "").toLowerCase();
      let data;
      if (ctype.indexOf("application/x-www-form-urlencoded") !== -1) {
        data = querystring.parse(raw);
      } else {
        try { data = JSON.parse(raw || "{}"); } catch (e) { data = null; }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          sendJson(res, 400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
          return;
        }
      }

      /* Honeypot — bots fill the hidden field; pretend success, store nothing. */
      if (fieldValue(data, "company-website").trim() !== "") {
        logInfo("[contact] honeypot hit — ignored");
        sendJson(res, 200, { ok: true }, corsOrigin);
        return;
      }

      let pool;
      try { pool = getPool(); } catch (e) { pool = null; }
      if (!pool) {
        logError("[contact] storage unavailable — database not configured");
        sendJson(res, 503, { ok: false, error: "Server not configured" }, corsOrigin);
        return;
      }

      const record = normalize(data);
      if (!record) {
        logInfo("[contact] rejected — invalid submission");
        sendJson(res, 422, { ok: false, error: "Invalid submission" }, corsOrigin);
        return;
      }

      const ipHash = hashIp(clientIp(req), ipSalt);
      const userAgent = String(req.headers["user-agent"] || "")
        .replace(/[\r\n\t]/g, " ").trim().slice(0, 255);

      pool.execute(COUNT_SQL, [ipHash]).then(function (result) {
        if (countFromResult(result) >= MAX_ENQUIRIES_PER_10_MIN) {
          logInfo("[contact] rate limited");
          sendJson(res, 429, { ok: false, error: "Too many submissions" }, corsOrigin);
          return;
        }
        return pool.execute(INSERT_SQL, [
          record.name, record.business, record.email, record.phone,
          record.topic, record.message, ipHash, userAgent
        ]).then(function (insertResult) {
          let id = "-";
          try {
            const r = Array.isArray(insertResult) ? insertResult[0] : insertResult;
            if (r && r.insertId != null) id = String(r.insertId);
          } catch (e) { /* id is cosmetic in logs only */ }
          logInfo("[contact] enquiry stored (id=" + id + ")");

          /* Email notification is best-effort; the DB row is the real record.
             A failed/slow SMTP call never delays or breaks the response. */
          if (notify) {
            Promise.resolve().then(function () { return notify(record); }).catch(function (err) {
              logError("[contact] notification failed (code=" + ((err && err.code) || "unknown") + ")");
            });
          }
          sendJson(res, 200, { ok: true }, corsOrigin);
        });
      }).catch(function (err) {
        /* Log the error code only — messages can contain host/credential hints. */
        logError("[contact] database error (code=" + ((err && err.code) || "unknown") + ")");
        sendJson(res, 500, { ok: false, error: "Server error" }, corsOrigin);
      });
    });
  };
};
