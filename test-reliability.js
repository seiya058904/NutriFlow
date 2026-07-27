const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function app(file, clock, storage = {}) {
  const html = fs.readFileSync(file, "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const cut = script.indexOf('document.querySelector("#recordForm")');
  const values = new Map();
  const element = () => ({ value: "", textContent: "", className: "", innerHTML: "", classList: { add() {}, remove() {} }, addEventListener() {} });
  class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [clock.value])); } static now() { return new Date(clock.value).getTime(); } }
  const context = {
    Date: TestDate,
    Map,
    Math,
    Number,
    String,
    Array,
    JSON,
    RegExp,
    setTimeout() {},
    clearTimeout() {},
    window: { setTimeout() {}, clearTimeout() {}, requestAnimationFrame(fn) { fn(); } },
    document: { querySelector(selector) { if (!values.has(selector)) values.set(selector, element()); return values.get(selector); } },
    localStorage: { getItem(key) { return storage[key] ?? null; }, setItem(key, value) { if (storage.__throwOn === key) throw new Error("quota"); storage[key] = value; } },
    confirm() { return true; }
  };
  vm.createContext(context);
  vm.runInContext(`${script.slice(0, cut)}; globalThis.test = { loadRecords, saveRecords, getSortedRecords, consecutiveRecordDays, refreshToday, makeIntakeOverview, movingAverage, groupRecordsByCalendarWeek, recordsByDate, getState: () => ({ today, selectedDate, calendarYear, calendarMonth }) };`, context);
  return { api: context.test, storage, context };
}

for (const file of ["NutriFlow.html", "index.html"]) {
  const raw = '[{"date":"2026-07-20","intake":1500},{"date":"bad","intake":-1}]';
  const clock = { value: "2026-07-27T12:00:00" };
  let instance = app(file, clock, { dailyDietRecordsV1: raw });
  instance.api.loadRecords();
  assert.equal(instance.api.getSortedRecords().length, 1, `${file}: keeps valid partial record`);
  assert.equal(instance.api.saveRecords(), true, `${file}: saves after backup`);
  assert.equal(instance.storage.dailyDietRecordsV1CorruptBackupV1, raw, `${file}: preserves exact partial raw value`);

  const nonArray = "{}";
  instance = app(file, clock, { dailyDietRecordsV1: nonArray });
  instance.api.loadRecords();
  assert.equal(instance.api.saveRecords(), true, `${file}: backs up non-array`);
  assert.equal(instance.storage.dailyDietRecordsV1CorruptBackupV1, nonArray, `${file}: preserves exact non-array raw value`);

  const malformed = "[{";
  instance = app(file, clock, { dailyDietRecordsV1: malformed });
  instance.api.loadRecords();
  assert.equal(instance.api.saveRecords(), true, `${file}: backs up malformed JSON`);
  assert.equal(instance.storage.dailyDietRecordsV1CorruptBackupV1, malformed, `${file}: preserves exact malformed raw value`);

  instance = app(file, clock, { dailyDietRecordsV1: '[{"date":"2026-07-20","intake":1500}]' });
  instance.api.loadRecords();
  assert.equal(instance.api.saveRecords(), true, `${file}: saves valid data`);
  assert.equal(instance.storage.dailyDietRecordsV1CorruptBackupV1, undefined, `${file}: valid data has no backup`);
  instance = app(file, clock, { dailyDietRecordsV1: '[{"date":"2026-07-20","intake":1500}]', __throwOn: "dailyDietRecordsV1" });
  instance.api.loadRecords();
  assert.equal(instance.api.saveRecords(), false, `${file}: reports storage write failure`);

  assert.match(instance.api.makeIntakeOverview([], [], null), /该范围暂无记录/, `${file}: empty chart range is safe`);
  const streak = (dates) => instance.api.consecutiveRecordDays(dates.map(date => ({ date })));
  assert.equal(streak(["2026-07-27"]), 1, `${file}: today streak`);
  assert.equal(streak(["2026-07-26"]), 1, `${file}: yesterday streak`);
  assert.equal(streak(["2026-07-25"]), 0, `${file}: old streak`);
  assert.equal(streak(["2026-07-28"]), 0, `${file}: future streak`);
  assert.equal(streak(["2026-07-27", "2026-07-28"]), 0, `${file}: future tail streak`);
  assert.equal(streak(["2026-07-26", "2026-07-27"]), 2, `${file}: yesterday plus today streak`);
  assert.equal(streak(["2026-07-25", "2026-07-26"]), 2, `${file}: previous two-day streak`);

  const duplicate = '[{"date":"2026-07-20","intake":1500},{"date":"2026-07-20","intake":1600}]';
  instance = app(file, clock, { dailyDietRecordsV1: duplicate });
  instance.api.loadRecords();
  assert.equal(instance.api.getSortedRecords().length, 1, `${file}: keeps one duplicate-date record`);
  assert.equal(instance.api.saveRecords(), true, `${file}: backs up duplicate dates`);
  assert.equal(instance.storage.dailyDietRecordsV1CorruptBackupV1, duplicate, `${file}: preserves duplicate raw value`);

  instance = app(file, clock, {});
  instance.context.document.querySelector("#dateInput").value = "2026-07-27";
  clock.value = "2026-08-01T00:00:02";
  instance.api.refreshToday();
  assert.deepEqual(JSON.parse(JSON.stringify(instance.api.getState())), { today: "2026-08-01", selectedDate: "2026-08-01", calendarYear: 2026, calendarMonth: 7 }, `${file}: midnight month sync`);

  const sparse = [
    { index: 0, date: "2026-07-01", value: 1000 }, { index: 1, date: "2026-07-02", value: 1200 },
    { index: 2, date: "2026-07-15", value: 2000 }, { index: 3, date: "2026-07-16", value: 2200 }
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(instance.api.movingAverage(sparse, sparse, 7).map(x => x.value))), [1000, 1100, 2000, 2100], `${file}: calendar 7-day average`);
  const sparseRecords = sparse.map(({ date, value: intake }) => ({ date, intake }));
  assert.equal(instance.api.groupRecordsByCalendarWeek(sparseRecords).length, 2, `${file}: calendar-week buckets`);
  assert.deepEqual(JSON.parse(JSON.stringify(instance.api.groupRecordsByCalendarWeek(sparseRecords).map(x => x.label))), ["2026-06-29 至 2026-07-05", "2026-07-13 至 2026-07-19"], `${file}: Monday-Sunday labels`);
  assert.deepEqual(JSON.parse(JSON.stringify(instance.api.groupRecordsByCalendarWeek(sparseRecords).map(x => x.avg))), [1100, 2100], `${file}: sparse weeks are not merged`);
}

console.log("NutriFlow reliability regression tests passed");
