/* FlowPilot site server — static hosting + Node.js contact API.
   Static files are served with Node built-ins only. The contact endpoint
   (api/contact.js) uses mysql2 for the GoDaddy hosted MySQL database and
   nodemailer for optional SMTP notifications; the GoDaddy host injects the
   DB_* environment variables — credentials are never hardcoded. */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".woff": "font/woff"
};

/* ---------- Contact API wiring (see api/contact.js) ----------
   The MySQL pool is created only when the GoDaddy-injected DB_* variables
   are present. Without them the endpoint answers 503 and the site's
   client-side fallback chain (FormSubmit email → mailto) keeps working,
   so the site never goes down over a missing database. */
let dbPool = null;
if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD) {
  try {
    const mysql = require("mysql2/promise");
    const dbConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 4,
      maxIdle: 2,
      idleTimeout: 60000,
      queueLimit: 10,
      connectTimeout: 8000,
      enableKeepAlive: true
    };
    if (String(process.env.DB_SSL || "").toLowerCase() === "true") {
      dbConfig.ssl = { rejectUnauthorized: false };
    }
    dbPool = mysql.createPool(dbConfig);
  } catch (err) {
    console.error("[contact] mysql2 unavailable (code=" + ((err && err.code) || "install") + ") — enquiry storage disabled");
    dbPool = null;
  }
} else {
  console.log("[contact] DB_* environment not set — enquiries fall back to email delivery");
}

const createContactHandler = require("./api/contact.js");
const createNotifier = require("./api/notify.js");

const notifier = createNotifier(process.env);
console.log("[contact] email notifications: " + (notifier.enabled ? "enabled (SMTP)" : "disabled — " + notifier.reason));

/* Salt for hashing visitor IPs: prefer the configured value; otherwise a
   random per-boot salt. Raw IPs are never stored either way. */
const ipSalt = process.env.IP_HASH_SALT || crypto.randomBytes(32).toString("hex");

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "https://flowpilotai.co.in,https://www.flowpilotai.co.in")
  .split(",")
  .map(function (s) { return s.trim(); })
  .filter(Boolean);

const contactHandler = createContactHandler({
  getPool: function () { return dbPool; },
  ipSalt: ipSalt,
  notify: notifier.enabled ? notifier.send : null,
  allowedOrigins: allowedOrigins
});

const server = http.createServer(function (req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (e) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  /* Contact API — POST /api/contact. The .php spelling is aliased to the Node
     handler so visitors with a cached older script still reach the API; the
     PHP source itself is never served. */
  if (urlPath.replace(/\.php$/i, "") === "/api/contact") {
    try {
      contactHandler(req, res);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "Server error" }));
      }
    }
    return;
  }

  // The contact form posts to "/" expecting a form backend (Netlify-style).
  // This host has none — return 405 so the client-side mailto fallback runs
  // and the enquiry is never silently dropped.
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  // Never serve dotfiles or dot-directories (.git, .env, ...) — the site is
  // deployed straight from the repo root. /.well-known/ stays reachable for
  // host verification files.
  if (urlPath.indexOf("/.") !== -1 && urlPath.indexOf("/.well-known/") !== 0) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  if (urlPath.endsWith("/")) urlPath += "index.html";

  const resolved = path.normalize(path.join(ROOT, urlPath));
  if (resolved !== ROOT && resolved.indexOf(ROOT + path.sep) !== 0) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  // PHP executes only on cPanel hosts — never serve the source from this host
  if (path.extname(resolved).toLowerCase() === ".php") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  fs.stat(resolved, function (err, stat) {
    var finalPath = resolved;
    if (err || !stat.isFile()) {
      // Unknown paths fall back to the homepage.
      finalPath = path.join(ROOT, "index.html");
    }
    fs.readFile(finalPath, function (readErr, data) {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Server error");
        return;
      }
      var ext = path.extname(finalPath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      });
      res.end(data);
    });
  });
});

/* A failed background promise (e.g. an SMTP error escaping a fire-and-forget
   call) must never take the whole site down. Logged without any content. */
process.on("unhandledRejection", function (err) {
  console.error("[server] unhandled rejection (code=" + ((err && err.code) || "unknown") + ")");
});

server.listen(PORT, function () {
  console.log("FlowPilot site ready — listening on port " + PORT);
});
