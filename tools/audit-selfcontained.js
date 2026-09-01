/* ==========================================================================
   tools/audit-selfcontained.js

   Fails loudly if the built student file references ANYTHING outside itself.
   Run after every build:  node tools/audit-selfcontained.js
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "dist", "ENIGMA-Student-Planner.html");

if (!fs.existsSync(FILE)) {
  console.error("BUILD MISSING:", FILE);
  process.exit(1);
}

const html = fs.readFileSync(FILE, "utf8");
const problems = [];
let checks = 0;

/**
 * @param {string} label what is being checked
 * @param {RegExp} re pattern that must NOT match (global)
 * @param {function(string[]):boolean} [allow] return true to permit a match
 */
function forbid(label, re, allow) {
  checks++;
  let m;
  const found = [];
  re.lastIndex = 0;
  while ((m = re.exec(html)) !== null) {
    if (allow && allow(m)) continue;
    found.push(m[0].slice(0, 110).replace(/\s+/g, " "));
    if (found.length > 4) break;
  }
  if (found.length) {
    problems.push(label + "\n      " + found.join("\n      "));
  }
}

/* A reference is fine only if it never leaves the document. */
const INLINE_OK = /^(data:|blob:|#|javascript:void)/i;

function isInline(value) {
  return INLINE_OK.test(String(value).trim());
}

/* --- markup that pulls in a file --------------------------------------- */

forbid("<link> pointing at an external file", /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi, (m) =>
  isInline(m[1])
);

forbid("<script src=...>", /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (m) =>
  isInline(m[1])
);

forbid("<img src=...> that is not a data URI", /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (m) =>
  isInline(m[1])
);

forbid("srcset attribute", /\bsrcset\s*=\s*["']([^"']+)["']/gi, (m) => isInline(m[1]));

forbid("<iframe|embed|object|video|audio|source|track> with a remote target",
  /<(?:iframe|embed|object|video|audio|source|track)\b[^>]*\b(?:src|data)\s*=\s*["']([^"']+)["'][^>]*>/gi,
  (m) => isInline(m[1])
);

forbid("<base> tag (would re-root every relative URL)", /<base\b[^>]*>/gi);

forbid("web app manifest", /rel\s*=\s*["']manifest["']/gi);

/* --- CSS that pulls in a file ------------------------------------------ */

/* Only look inside <style> blocks: `URL(...)` also appears in JavaScript as
   URL.createObjectURL, which is not a resource reference at all. */
const styleBlocks = (html.match(/<style>[\s\S]*?<\/style>/gi) || []).join("\n");

checks++;
const cssUrls = [];
let cssMatch;
const CSS_URL = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;
while ((cssMatch = CSS_URL.exec(styleBlocks)) !== null) {
  if (!isInline(cssMatch[2])) cssUrls.push(cssMatch[0].slice(0, 110));
}
if (cssUrls.length) {
  problems.push("CSS url(...) pointing at a file\n      " + cssUrls.join("\n      "));
}

forbid("CSS @import", /@import\b/gi);

forbid("@font-face (would need a font file)", /@font-face\b/gi);

/* --- runtime network calls --------------------------------------------- */

forbid("fetch( call", /\bfetch\s*\(/gi);
forbid("XMLHttpRequest", /\bXMLHttpRequest\b/gi);
forbid("dynamic import()", /\bimport\s*\(/gi);
forbid("WebSocket", /\bWebSocket\b/gi);
forbid("EventSource", /\bEventSource\b/gi);
forbid("navigator.sendBeacon", /sendBeacon/gi);
forbid("service worker registration", /serviceWorker/gi);

/* --- absolute URLs anywhere -------------------------------------------- */

forbid(
  "absolute http(s) URL",
  /["'(]\s*(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^"')\s]*/gi,
  (m) => /w3\.org\/2000\/svg|w3\.org\/1999\/xhtml/i.test(m[0]) /* XML namespaces, not fetched */
);

/* --- things that must be present --------------------------------------- */

function require_(label, condition) {
  checks++;
  if (!condition) problems.push("MISSING: " + label);
}

require_("the logo as an inline data URI", /HDML\.LOGO\s*=\s*"data:image\/png;base64,/.test(html));
require_("an inline favicon", /rel\s*=\s*["']icon["']/i.test(html));
require_("the embedded data payload tag", html.includes('<script id="hdml-data" type="application/json">'));
require_("inlined stylesheets", (html.match(/<style>/g) || []).length >= 5);
require_("the app bootstrap", html.includes("app-root"));
require_("RTL direction", /<html[^>]+dir=["']rtl["']/i.test(html));
require_("UTF-8 charset", /charset=["']?utf-8/i.test(html));

/* --- syntax an older mobile browser would refuse to parse --------------- *
 * A SyntaxError in a classic <script> kills the whole block, which is one of
 * the few ways this app could render a genuinely blank page. Everything the
 * student file ships must parse as ES5.                                     */

const rawScripts = (html.match(/<script>[\s\S]*?<\/script>/gi) || [])
  .map((b) => b.replace(/^<script>/i, "").replace(/<\/script>$/i, ""))
  .join("\n");

/* Strip comments and string literals first: a backtick inside a JSDoc block,
   or the `**` of a `/**` opener, are not template literals or exponents. */
function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ") /* block comments (incl. JSDoc)   */
    .replace(/(^|[^:\\])\/\/[^\n]*/g, "$1 ") /* line comments, keep http:// */
    .replace(/"(?:\\.|[^"\\])*"/g, '""') /* double-quoted strings         */
    .replace(/'(?:\\.|[^'\\])*'/g, "''"); /* single-quoted strings         */
}

const scriptBlocks = stripCommentsAndStrings(rawScripts);

function forbidInJs(label, re) {
  checks++;
  re.lastIndex = 0;
  const m = re.exec(scriptBlocks);
  if (m) {
    const at = scriptBlocks.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\s+/g, " ");
    problems.push("ES5-incompatible syntax: " + label + "\n      …" + at + "…");
  }
}

forbidInJs("arrow function (=>)", /=>/g);
forbidInJs("template literal (backtick)", /[`]/g);
forbidInJs("optional chaining (?.)", /\?\.[a-zA-Z_$(\[]/g);
forbidInJs("nullish coalescing (??)", /\?\?/g);
forbidInJs("class declaration", /\bclass\s+[A-Za-z_$][\w$]*\s*(\{|extends)/g);
forbidInJs("async function", /\basync\s+function\b/g);
forbidInJs("await", /\bawait\s+[a-zA-Z_$(]/g);
forbidInJs("spread/rest (...)", /\.\.\./g);
forbidInJs("let binding", /\blet\s+[a-zA-Z_$]/g);
forbidInJs("const binding", /\bconst\s+[a-zA-Z_$]/g);
forbidInJs("for…of", /\bfor\s*\(\s*(?:var\s+)?[\w$]+\s+of\s/g);
forbidInJs("exponent operator (**)", /[^*]\*\*[^*]/g);
forbidInJs("ES module import", /\bimport\s*[({'"]/g);
forbidInJs("ES module export", /\bexport\s+(default|const|function|\{)/g);

/* --- a blank page must be impossible ------------------------------------ */

require_(
  "a static fallback inside #app-root (so the page is never blank)",
  /id=["']boot-fallback["']/.test(html)
);
require_("a global error boundary", /__enigmaFail/.test(html));
require_("a <noscript> message", /<noscript>/i.test(html));

/* --- report ------------------------------------------------------------ */

const sizeKb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log("File   :", path.relative(path.join(__dirname, ".."), FILE));
console.log("Size   :", sizeKb, "KB");
console.log("Checks :", checks);

if (problems.length) {
  console.log("\nNOT SELF-CONTAINED — " + problems.length + " problem(s):\n");
  problems.forEach((p) => console.log("  ✗ " + p));
  process.exit(1);
}

console.log("\n✓ SELF-CONTAINED — no external references of any kind.");
console.log("  Safe to copy this single file anywhere and open it offline.");
