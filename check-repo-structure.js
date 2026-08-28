const assert = require("assert");
const fs = require("fs");

const required = [
  "NutriFlow.html",
  "index.html",
  "manifest.json",
  "sw.js",
  "test-reliability.js",
  "test-parity.js"
];
for (const file of required) {
  assert.ok(fs.existsSync(file), `required file missing: ${file}`);
}

const nutriflow = fs.readFileSync("NutriFlow.html", "utf8");
assert.ok(!nutriflow.includes("INITIAL_RECORDS"), "NutriFlow.html must not contain demo seed data");
assert.ok(!nutriflow.includes("importInitialRecords"), "NutriFlow.html must not contain demo seed initializer");
assert.ok(nutriflow.includes("dailyDietRecordsV1"), "NutriFlow.html must preserve legacy storage key");

const index = fs.readFileSync("index.html", "utf8");
assert.ok(index.includes("INITIAL_RECORDS"), "index.html may contain demo seed data");
assert.ok(index.includes("importInitialRecords"), "index.html may contain demo seed initializer");

console.log("NutriFlow repository structure OK");
