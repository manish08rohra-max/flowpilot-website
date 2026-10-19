"use strict";
/* End-to-end test — runs the real server.js process WITHOUT DB_* environment
   variables, then checks:
   • static site + assets still serve normally
   • POST /api/contact answers 503 "Server not configured" (no DB) — the
     client-side fallback chain handles this case
   • the /api/contact.php alias routes to the Node handler (cached clients)
   • non-API POSTs still answer 405, PHP sources and dotfiles stay hidden */

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = 31987;
const BASE = "http://127.0.0.1:" + PORT;

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

test("server.js: site serves, contact API reports not-configured without DB_* env", async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.on("error", function (err) { assert.fail("failed to start server.js: " + err.message); });

  try {
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      try {
        const r = await fetch(BASE + "/");
        if (r.ok) ready = true;
      } catch (e) { await sleep(100); }
    }
    assert.ok(ready, "server became ready on " + BASE);

    const home = await fetch(BASE + "/");
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<!DOCTYPE html>/i);

    const css = await fetch(BASE + "/css/styles.css");
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type") || "", /text\/css/);

    const api = await fetch(BASE + "/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "T", email: "t@example.com", message: "hi" })
    });
    assert.equal(api.status, 503);
    assert.deepEqual(await api.json(), { ok: false, error: "Server not configured" });

    const apiAlias = await fetch(BASE + "/api/contact.php", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "T", email: "t@example.com", message: "hi" })
    });
    assert.equal(apiAlias.status, 503, "cached clients hitting .php reach the Node handler");

    const apiGet = await fetch(BASE + "/api/contact.php");
    assert.equal(apiGet.status, 405, "GET on the API answers 405, never serves source");

    const otherPost = await fetch(BASE + "/something-else", { method: "POST" });
    assert.equal(otherPost.status, 405);

    const dotGit = await fetch(BASE + "/.git/config");
    assert.equal(dotGit.status, 404, "dotfiles/dot-directories are never served");

    const phpSource = await fetch(BASE + "/api/config.sample.php");
    assert.equal(phpSource.status, 404, "PHP sources are never served");

    const unknown = await fetch(BASE + "/no-such-page");
    assert.equal(unknown.status, 200, "unknown paths still fall back to the homepage");
  } finally {
    child.kill();
    await sleep(200);
  }
});
