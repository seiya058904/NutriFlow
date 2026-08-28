const assert = require("assert");
const fs = require("fs");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function firstScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, "expected an inline script");
  return match[1];
}

function normalizeScript(script) {
  let text = script;
  text = text.replace(/^    const SEED_KEY = "dailyDietSeed[^"]*";.*\n(?:.*\n)*?    \];\n/gm, "");
  text = text.replace(/^    function importInitialRecords\(\) \{[\s\S]*?\n    \}\n\n/gm, "");
  text = text.replace(/    importInitialRecords\(\);\n/g, "");
  return text.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim() !== "").join("\n");
}

function normalizeDocument(html, allowIndexExtras) {
  let text = html;
  if (allowIndexExtras) {
    text = text.replace(/  <link rel="manifest" href="manifest\.json">\n/, "");
    text = text.replace(/\n  <script>\n    if \("serviceWorker" in navigator\) \{[\s\S]*?  <\/script>\n?/, "\n");
  }
  // Normalize the main inline script in both documents so index-only seed/PWA
  // differences do not mask core logic drift.
  const mainScript = firstScript(text);
  const normalized = normalizeScript(mainScript);
  text = text.replace(/<script>([\s\S]*?)<\/script>/, `<script>${normalized}</script>`);
  return text.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim() !== "").join("\n");
}

const nutriflow = read("NutriFlow.html");
const index = read("index.html");

const nutriflowStyle = nutriflow.match(/<style>([\s\S]*?)<\/style>/)[1];
const indexStyle = index.match(/<style>([\s\S]*?)<\/style>/)[1];
assert.strictEqual(nutriflowStyle, indexStyle, "CSS must stay identical between NutriFlow.html and index.html");

const nutriflowDoc = normalizeDocument(nutriflow, false);
const indexDoc = normalizeDocument(index, true);
assert.strictEqual(nutriflowDoc, indexDoc, "HTML structure and core JS logic must stay in parity after removing allowed index-only seed/PWA wiring");

console.log("NutriFlow HTML parity checks passed");
