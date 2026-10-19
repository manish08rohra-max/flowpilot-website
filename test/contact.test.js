"use strict";
/* Contact API unit tests — run with `npm test` (node --test).
   Uses a stubbed MySQL pool, so no database is required. */

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const createContactHandler = require("../api/contact.js");

const VALID = {
  name: "Test User",
  business: "Test Co",
  email: "test@example.com",
  phone: "+1 555 123 4567",
  topic: "insurance",
  message: "Automate carrier downloads please."
};

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function makeStubPool(opts) {
  opts = opts || {};
  const calls = { countQueries: 0, inserted: [] };
  return {
    calls: calls,
    execute: function (sql, params) {
      if (/^SELECT COUNT/i.test(sql)) {
        calls.countQueries++;
        return Promise.resolve([[{ n: opts.count != null ? opts.count : 0 }], []]);
      }
      if (/^INSERT INTO enquiries/i.test(sql)) {
        calls.inserted.push(params);
        return Promise.resolve([{ insertId: calls.inserted.length, affectedRows: 1 }, []]);
      }
      return Promise.reject(Object.assign(new Error("unexpected SQL"), { code: "ER_UNEXPECTED" }));
    }
  };
}

function spyNotifier(shouldFail) {
  const calls = [];
  return {
    calls: calls,
    notify: function (record) {
      calls.push(record);
      if (shouldFail) {
        return Promise.reject(Object.assign(new Error("SMTP unavailable"), { code: "ETIMEDOUT" }));
      }
      return Promise.resolve(true);
    }
  };
}

function mount(handler) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) { handler(req, res); });
    server.listen(0, "127.0.0.1", function () {
      resolve({ server: server, base: "http://127.0.0.1:" + server.address().port });
    });
  });
}

async function close(server) {
  await new Promise(function (resolve) { server.close(resolve); });
  await sleep(0);
}

async function postJson(base, body, headers) {
  return fetch(base + "/api/contact", {
    method: "POST",
    headers: Object.assign({ "content-type": "application/json", "user-agent": "node-test-agent" }, headers || {}),
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

test("stores a valid enquiry with prepared-statement parameters and notifies", async () => {
  const pool = makeStubPool();
  const nf = spyNotifier(false);
  const h = createContactHandler({ getPool: function () { return pool; }, ipSalt: "test-salt", notify: nf.notify, allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    const res = await postJson(base, VALID);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });

    assert.equal(pool.calls.countQueries, 1, "rate-limit query ran once");
    assert.equal(pool.calls.inserted.length, 1, "exactly one insert");

    const params = pool.calls.inserted[0];
    assert.equal(params.length, 8);
    assert.equal(params[0], "Test User");
    assert.equal(params[1], "Test Co");
    assert.equal(params[2], "test@example.com");
    assert.equal(params[3], "+1 555 123 4567");
    assert.equal(params[4], "insurance");
    assert.equal(params[5], "Automate carrier downloads please.");
    assert.match(params[6], /^[0-9a-f]{64}$/, "ip_hash is a salted sha256 hex digest");
    assert.equal(params[7], "node-test-agent");

    assert.equal(nf.calls.length, 1, "notifier called once");
    assert.equal(nf.calls[0].email, "test@example.com");
  } finally { await close(server); }
});

test("honeypot submissions get a fake success and touch nothing", async () => {
  const pool = makeStubPool();
  const nf = spyNotifier(false);
  const h = createContactHandler({ getPool: function () { return pool; }, ipSalt: "s", notify: nf.notify, allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    const res = await postJson(base, Object.assign({}, VALID, { "company-website": "http://spam.example" }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(pool.calls.countQueries, 0, "no DB queries for bots");
    assert.equal(pool.calls.inserted.length, 0);
    assert.equal(nf.calls.length, 0, "no email for bots");
  } finally { await close(server); }
});

test("invalid submissions are rejected with 422 and never stored", async () => {
  const cases = [
    ["missing name", Object.assign({}, VALID, { name: "" })],
    ["name over 120 chars", Object.assign({}, VALID, { name: "x".repeat(121) })],
    ["business over 160 chars", Object.assign({}, VALID, { business: "x".repeat(161) })],
    ["invalid email", Object.assign({}, VALID, { email: "not-an-email" })],
    ["email header injection", Object.assign({}, VALID, { email: "a@b.co\r\nBcc: x@y.z" })],
    ["email over 190 chars", Object.assign({}, VALID, { email: "x".repeat(190) + "@b.co" })],
    ["phone over 40 chars", Object.assign({}, VALID, { phone: "9".repeat(41) })],
    ["topic over 80 chars", Object.assign({}, VALID, { topic: "x".repeat(81) })],
    ["missing message", Object.assign({}, VALID, { message: "   " })],
    ["message over 5000 chars", Object.assign({}, VALID, { message: "x".repeat(5001) })]
  ];
  for (const [label, body] of cases) {
    const pool = makeStubPool();
    const h = createContactHandler({ getPool: function () { return pool; }, ipSalt: "s", allowedOrigins: [] });
    const { server, base } = await mount(h);
    try {
      const res = await postJson(base, body);
      assert.equal(res.status, 422, label);
      assert.deepEqual(await res.json(), { ok: false, error: "Invalid submission" }, label);
      assert.equal(pool.calls.inserted.length, 0, label + " — nothing inserted");
    } finally { await close(server); }
  }
});

test("HTML tags are stripped from single-line and message fields", async () => {
  const pool = makeStubPool();
  const h = createContactHandler({ getPool: function () { return pool; }, ipSalt: "s", allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    await postJson(base, Object.assign({}, VALID, {
      name: "<b>Ravi</b> <script>alert(1)</script>K",
      message: "Line one\r\nLine two"
    }));
    const params = pool.calls.inserted[0];
    assert.equal(params[0], "Ravi alert(1)K");
    assert.equal(params[5], "Line one\nLine two");
  } finally { await close(server); }
});

test("rate limit: 5 enquiries per 10 minutes per hashed IP", async () => {
  const blocked = makeStubPool({ count: 5 });
  const h1 = createContactHandler({ getPool: function () { return blocked; }, ipSalt: "s", allowedOrigins: [] });
  const s1 = await mount(h1);
  try {
    const res = await postJson(s1.base, VALID);
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { ok: false, error: "Too many submissions" });
    assert.equal(blocked.calls.inserted.length, 0);
  } finally { await close(s1.server); }

  const allowed = makeStubPool({ count: 4 });
  const h2 = createContactHandler({ getPool: function () { return allowed; }, ipSalt: "s", allowedOrigins: [] });
  const s2 = await mount(h2);
  try {
    const res = await postJson(s2.base, VALID);
    assert.equal(res.status, 200);
    assert.equal(allowed.calls.inserted.length, 1);
  } finally { await close(s2.server); }
});

test("different salts produce different IP hashes; same salt is stable", async () => {
  const poolA = makeStubPool();
  const poolB = makeStubPool();
  const hA = createContactHandler({ getPool: function () { return poolA; }, ipSalt: "salt-one", allowedOrigins: [] });
  const hB = createContactHandler({ getPool: function () { return poolB; }, ipSalt: "salt-two", allowedOrigins: [] });
  const sA = await mount(hA);
  const sB = await mount(hB);
  try {
    await postJson(sA.base, VALID);
    await postJson(sA.base, VALID);
    await postJson(sB.base, VALID);
    assert.equal(poolA.calls.inserted[0][6], poolA.calls.inserted[1][6], "same salt, same hash");
    assert.notEqual(poolA.calls.inserted[0][6], poolB.calls.inserted[0][6], "different salt, different hash");
  } finally { await close(sA.server); await close(sB.server); }
});

test("method and preflight handling", async () => {
  const pool = makeStubPool();
  const h = createContactHandler({
    getPool: function () { return pool; },
    ipSalt: "s",
    allowedOrigins: ["https://flowpilotai.co.in"]
  });
  const { server, base } = await mount(h);
  try {
    const get = await fetch(base + "/api/contact");
    assert.equal(get.status, 405);
    assert.match(get.headers.get("allow") || "", /POST/);

    const preflight = await fetch(base + "/api/contact", {
      method: "OPTIONS",
      headers: { "Origin": "https://flowpilotai.co.in", "Access-Control-Request-Method": "POST" }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://flowpilotai.co.in");
    assert.match(preflight.headers.get("access-control-allow-methods") || "", /POST/);
  } finally { await close(server); }
});

test("CORS: allowed origins are reflected, others are not", async () => {
  const pool = makeStubPool();
  const h = createContactHandler({
    getPool: function () { return pool; },
    ipSalt: "s",
    allowedOrigins: ["https://flowpilotai.co.in"]
  });
  const { server, base } = await mount(h);
  try {
    const ok = await postJson(base, VALID, { "Origin": "https://flowpilotai.co.in" });
    assert.equal(ok.headers.get("access-control-allow-origin"), "https://flowpilotai.co.in");

    const bad = await postJson(base, VALID, { "Origin": "https://evil.example" });
    assert.equal(bad.headers.get("access-control-allow-origin"), null);
  } finally { await close(server); }
});

test("malformed and oversized bodies are rejected cleanly", async () => {
  const pool = makeStubPool();
  const h = createContactHandler({ getPool: function () { return pool; }, ipSalt: "s", allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    const badJson = await postJson(base, "{not json");
    assert.equal(badJson.status, 400);
    assert.deepEqual(await badJson.json(), { ok: false, error: "Invalid JSON body" });

    const arrayBody = await postJson(base, "[1,2,3]");
    assert.equal(arrayBody.status, 400);

    const huge = await postJson(base, "x".repeat(33 * 1024));
    assert.equal(huge.status, 413);
    assert.deepEqual(await huge.json(), { ok: false, error: "Payload too large" });
    assert.equal(pool.calls.inserted.length, 0);
  } finally { await close(server); }
});

test("form-encoded submissions are accepted too", async () => {
  const pool = makeStubPool();
  const h = createContactHandler({ getPool: function () { return pool; }, ipSalt: "s", allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    const res = await fetch(base + "/api/contact", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "node-test-agent" },
      body: "name=Form%20User&email=form%40example.com&message=Hello%20from%20a%20form"
    });
    assert.equal(res.status, 200);
    const params = pool.calls.inserted[0];
    assert.equal(params[0], "Form User");
    assert.equal(params[2], "form@example.com");
    assert.equal(params[5], "Hello from a form");
  } finally { await close(server); }
});

test("database errors return a generic 500 that leaks nothing", async () => {
  const leaky = "Access denied for user 'fp_user'@'10.0.0.5' (using password: YES)";
  const badPool = {
    execute: function () {
      return Promise.reject(Object.assign(new Error(leaky), { code: "ER_ACCESS_DENIED_ERROR" }));
    }
  };
  const h = createContactHandler({ getPool: function () { return badPool; }, ipSalt: "s", allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    const res = await postJson(base, VALID);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.equal(text, '{"ok":false,"error":"Server error"}');
    assert.ok(text.indexOf("Access denied") === -1, "no driver message in body");
    assert.ok(text.indexOf("fp_user") === -1, "no user in body");
    assert.ok(text.indexOf("ER_ACCESS_DENIED") === -1, "no error code in body");
  } finally { await close(server); }
});

test("missing database configuration answers 503 (client falls back to email)", async () => {
  const h = createContactHandler({ getPool: function () { return null; }, ipSalt: "s", allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    const res = await postJson(base, VALID);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false, error: "Server not configured" });
  } finally { await close(server); }
});

test("a failing notifier never fails the enquiry", async () => {
  const pool = makeStubPool();
  const nf = spyNotifier(true);
  const h = createContactHandler({ getPool: function () { return pool; }, ipSalt: "s", notify: nf.notify, allowedOrigins: [] });
  const { server, base } = await mount(h);
  try {
    const res = await postJson(base, VALID);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(pool.calls.inserted.length, 1);
    await sleep(20); // let the rejection handler run; it must only log
  } finally { await close(server); }
});
