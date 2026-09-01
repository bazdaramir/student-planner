/* ==========================================================================
   build.js - produce the single self-contained student file

   Zero dependencies. Reads src/index.html, inlines every stylesheet and
   script in place, and writes dist/ENIGMA-Student-Planner.html.

   Usage:  node build.js
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const DIST_DIR = path.join(__dirname, "dist");
const ENTRY = path.join(SRC_DIR, "index.html");
const OUTPUT = path.join(DIST_DIR, "ENIGMA-Student-Planner.html");

const LINK_RE = /[ \t]*<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>\s*\n?/gi;
const SCRIPT_RE = /[ \t]*<script[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>\s*\n?/gi;

function read(relPath) {
  const full = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(full)) {
    throw new Error("Referenced asset not found: " + relPath);
  }
  return fs.readFileSync(full, "utf8");
}

/** A closing script tag inside JS source would terminate the inline block. */
function guardScript(code) {
  return code.replace(/<\/script>/gi, "<\\/script>");
}

function build() {
  if (!fs.existsSync(ENTRY)) {
    throw new Error("src/index.html not found");
  }

  let html = fs.readFileSync(ENTRY, "utf8");
  const inlinedCss = [];
  const inlinedJs = [];

  html = html.replace(LINK_RE, (match, href) => {
    const css = read(href);
    inlinedCss.push(href);
    return "    <style>\n/* ===== " + href + " ===== */\n" + css + "\n    </style>\n";
  });

  html = html.replace(SCRIPT_RE, (match, src) => {
    const js = read(src);
    inlinedJs.push(src);
    return (
      "    <script>\n/* ===== " + src + " ===== */\n" + guardScript(js) + "\n    </script>\n"
    );
  });

  /* --- sanity checks ---------------------------------------------------- */
  const problems = [];
  if (/<link[^>]*rel=["']stylesheet["']/i.test(html)) {
    problems.push("a stylesheet link survived inlining");
  }
  if (/<script[^>]*\ssrc=/i.test(html)) {
    problems.push("a script src survived inlining");
  }
  if (!html.includes('<script id="hdml-data" type="application/json">')) {
    problems.push("the hdml-data payload tag is missing");
  }
  if (!html.includes("data:image/png;base64,")) {
    problems.push("the logo data URI is missing");
  }
  if (problems.length) {
    throw new Error("Build produced an invalid artifact: " + problems.join("; "));
  }

  html = html.replace(
    "<head>",
    "<head>\n    <!-- Built by build.js — single self-contained file. Works offline from file://. -->"
  );

  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, html, "utf8");

  const sizeKb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log("Inlined CSS :", inlinedCss.length, "files");
  console.log("Inlined JS  :", inlinedJs.length, "files");
  console.log("Output      :", path.relative(__dirname, OUTPUT));
  console.log("Size        :", sizeKb, "KB");
  console.log("");

  /* The artifact is only valid if it needs nothing beside it. Enforced here
     so the guarantee cannot quietly regress. */
  require("child_process").execFileSync(
    process.execPath,
    [path.join(__dirname, "tools", "audit-selfcontained.js")],
    { stdio: "inherit" }
  );
}

try {
  build();
} catch (err) {
  console.error("BUILD FAILED:", err.message);
  process.exit(1);
}
