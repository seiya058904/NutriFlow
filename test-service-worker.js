const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");
const source = fs.readFileSync(process.env.QA_SW_SOURCE || "sw.js", "utf8");

function setup(scope = "https://example.test/nutri/") {
  const handlers = {}, deleted = [], keys = new Set([
    `nutriflow:${scope}:v0`, `nutriflow:${scope}:v1`,
    "nutriflow:https://example.test/nutri/:v0", "nutriflow:https://example.test/another/:v0",
    `nutriflow:${scope}:vother-app`, `nutriflow:${scope}:v1/nested/:v0`,
    "other-app-offline-v7", "diet-tracker-v1"
  ]);
  const ctx = {
    self: { registration: { scope }, addEventListener: (event, handler) => handlers[event] = handler,
      skipWaiting() {}, clients: { claim() {} } },
    caches: { keys: async () => [...keys], delete: async key => { deleted.push(key); keys.delete(key); return true; },
      open: async key => ({ addAll: async assets => { keys.add(key); assert.deepEqual(Array.from(assets), ["./index.html"]); },
        match: async request => ({ owner: key, request }) }),
      match: async request => ({ owner: "foreign-cache", request }) },
    fetch: async request => { throw new Error("offline"); }
  };
  vm.runInNewContext(source, ctx);
  async function event(name, extras = {}) {
    let done; handlers[name]({ ...extras, waitUntil(promise) { done = promise; }, respondWith(promise) { done = promise; } });
    return await done;
  }
  return { keys, deleted, event };
}
test("activation deletes only older caches owned by this registration", async () => {
  const app = setup(); await app.event("activate");
  assert.deepEqual(app.deleted, ["nutriflow:https://example.test/nutri/:v0"]);
  assert.ok(app.keys.has("other-app-offline-v7")); assert.ok(app.keys.has("diet-tracker-v1"));
  assert.ok(app.keys.has("nutriflow:https://example.test/another/:v0"));
  assert.ok(app.keys.has("nutriflow:https://example.test/nutri/:v1"));
  assert.ok(app.keys.has("nutriflow:https://example.test/nutri/:vother-app"));
  assert.ok(app.keys.has("nutriflow:https://example.test/nutri/:v1/nested/:v0"));
});
test("two same-origin registrations retain each other's cache", async () => {
  const app = setup("https://example.test/another/"); await app.event("activate");
  assert.ok(app.keys.has("nutriflow:https://example.test/nutri/:v0"));
});
test("install and offline lookup use the current registration cache", async () => {
  const app = setup(); await app.event("install");
  const response = await app.event("fetch", { request: "https://example.test/nutri/index.html" });
  assert.equal(response.owner, "nutriflow:https://example.test/nutri/:v1");
});
