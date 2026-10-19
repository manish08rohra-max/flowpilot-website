/* Zero-dependency static file server.
   Used by hosting platforms that require a listening process (npm start).
   Serves the repo root on process.env.PORT (or 3000) — no npm packages needed. */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

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

const server = http.createServer(function (req, res) {
  // The contact form posts to "/" expecting a form backend (Netlify-style).
  // This host has none — return 405 so the client-side mailto fallback runs
  // and the enquiry is never silently dropped.
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (e) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const resolved = path.normalize(path.join(ROOT, urlPath));
  if (resolved !== ROOT && resolved.indexOf(ROOT + path.sep) !== 0) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
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

server.listen(PORT, function () {
  console.log("FlowPilot site ready — listening on port " + PORT);
});
