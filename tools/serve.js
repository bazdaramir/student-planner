/* Minimal zero-dependency static server, used only for local testing.
   The product itself never needs a server. */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml"
};

http
  .createServer((req, res) => {
    const parsed = url.parse(req.url);
    let rel = decodeURIComponent(parsed.pathname);
    if (rel === "/") rel = "/dist/ENIGMA-Student-Planner.html";

    const full = path.join(ROOT, rel);
    if (!full.startsWith(ROOT)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(full, (err, data) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found: " + rel);
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(full).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log("serving " + ROOT + " on http://localhost:" + PORT);
  });
