const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function app(file, clock, storage = {}) {
  const html = fs.readFileSync(file, "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const cut = script.indexOf('document.querySelector("#recordForm")');
  const values = new Map();
  const element = () => ({ value: "", textContent: "", className: "", innerHTML: "", hidden: false, classList: { add() {}, remove() {} }, addEventListener() {}, setAttribute() {}, appendChild() {} });
  const documentElement = {
    attribute: "light",
    getAttribute(name) { return name === "data-theme" ? this.attribute : null; },
    setAttribute(name, value) { if (name === "data-theme") this.attribute = value; },
    removeAttribute(name) { if (name === "data-theme") this.attribute = "light"; }
  };
  function storageError(key) {
    if (storage.__throwOn === key) return true;
    if (Array.isArray(storage.__throwOn) && storage.__throwOn.includes(key)) return true;
    if (storage.__throwSet === key) return true;
    if (Array.isArray(storage.__throwSet) && storage.__throwSet.includes(key)) return true;
    return false;
  }
  function makeStorageError() {
    const error = new Error(storage.__throwMessage || "storage failure");
    if (storage.__throwName) error.name = storage.__throwName;
    return error;
  }
  const setCounts = new Map();
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
    window: { setTimeout() {}, clearTimeout() {}, requestAnimationFrame(fn) { fn(); }, addEventListener() {} },
    document: {
      documentElement,
      addEventListener() {},
      querySelector(selector) { if (!values.has(selector)) values.set(selector, element()); return values.get(selector); },
      createElement() { return element(); }
    },
    localStorage: {
      getItem(key) { return storage[key] ?? null; },
      setItem(key, value) {
        if (storageError(key)) throw makeStorageError();
        const count = (setCounts.get(key) || 0) + 1;
        const limit = storage.__failAfterSet && storage.__failAfterSet[key];
        if (limit !== undefined && count > limit) throw makeStorageError();
        setCounts.set(key, count);
        storage[key] = value;
      },
      removeItem(key) { if (storageError(key)) throw makeStorageError(); delete storage[key]; }
    },
    confirm() { return true; },
    applyTheme(theme) { documentElement.setAttribute("data-theme", theme); },
    THEME_KEY: "dailyDietThemeV1"
  };
  vm.createContext(context);
  vm.runInContext(`${script.slice(0, cut)}; globalThis.test = { loadRecords, loadTargets, saveRecords, getSortedRecords, consecutiveRecordDays, refreshToday, makeIntakeOverview, movingAverage, groupRecordsByCalendarWeek, parseImportRows, findDuplicateDates, applyRecordMutationAndSave, recordsByDate, renderTargetProgress, metricTargetStatus, restoreFullBackup, normalizeTargetsObject, writeStorageDirect, setDailyTargets: (targets) => { dailyTargets = targets; }, getDailyTargets: () => ({ ...dailyTargets }), renderStorageStatus, getStorageUnavailable: () => storageUnavailable, writeTargets, storageSet, recoverRestoreJournal, ensureRestoreRecovery, isValidRestoreJournal, getRestoreRecoveryPending: () => restoreRecoveryPending, getState: () => ({ today, selectedDate, calendarYear, calendarMonth }) };`, context);
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

  const before = JSON.stringify(instance.api.getSortedRecords());
  const beforeState = JSON.stringify(instance.api.getState());
  assert.equal(instance.api.applyRecordMutationAndSave(() => instance.api.recordsByDate.set("2026-07-27", { date: "2026-07-27", intake: 900 })), false, `${file}: transaction reports failed write`);
  assert.equal(JSON.stringify(instance.api.getSortedRecords()), before, `${file}: failed transaction rolls records back`);
  assert.equal(JSON.stringify(instance.api.getState()), beforeState, `${file}: failed transaction restores selection`);
  assert.match(instance.api.parseImportRows("2026-07-20,100\n2026-07-20,200").errors.join(" "), /日期重复/, `${file}: text duplicate rejected`);
  assert.deepEqual(JSON.parse(JSON.stringify(instance.api.findDuplicateDates([{ date: "2026-07-20" }, { date: "2026-07-20" }, { date: "2026-07-21" }, { date: "2026-07-21" }]))), ["2026-07-20", "2026-07-21"], `${file}: shared duplicate helper`);

  const waterSamples = [
    { name: "LF with header", text: "日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)\n2026-07-20,1500,70,60,2000", date: "2026-07-20", water: 2000 },
    { name: "CRLF with header and zero water", text: "日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)\r\n2026-07-20,1500,70,60,2000\r\n2026-07-21,1600,71,65,0", date: "2026-07-21", water: 0 },
    { name: "no header empty water", text: "2026-07-20,1500,70,60,", date: "2026-07-20", water: "" },
    { name: "no header missing water", text: "2026-07-20,1500,70,60", date: "2026-07-20", water: "" },
    { name: "Chinese units", text: "2026年7月20日 1500大卡 体重70kg 蛋白质60g 饮水2000ml", date: "2026-07-20", water: 2000 }
  ];
  for (const sample of waterSamples) {
    const parsed = instance.api.parseImportRows(sample.text);
    assert.equal(parsed.errors.length, 0, `${file}: ${sample.name} has no errors`);
    const record = parsed.records.find((item) => item.date === sample.date);
    assert.ok(record, `${file}: ${sample.name} contains expected date`);
    assert.equal(record.water, sample.water, `${file}: ${sample.name} preserves water`);
  }
  assert.equal(instance.api.parseImportRows("日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)\r\n2026-07-20,1500,70,60,2000\r\n2026-07-21,1600,71,65,2000").records.length, 2, `${file}: CRLF import reads all rows`);

  const csvRoundTrips = [
    { name: "LF header full", text: "日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)\n2026-07-20,1500,70,60,2000", expected: { date: "2026-07-20", intake: 1500, weight: 70, protein: 60, water: 2000 } },
    { name: "CRLF header decimals", text: "日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)\r\n2026-07-20,1500.5,70.2,60.3,2000.75", expected: { date: "2026-07-20", intake: 1500.5, weight: 70.2, protein: 60.3, water: 2000.75 } },
    { name: "BOM header", text: "\ufeff日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)\n2026-07-20,1500,70,60,2000", expected: { date: "2026-07-20", intake: 1500, weight: 70, protein: 60, water: 2000 } },
    { name: "no header empty optionals", text: "2026-07-20,1500,,,", expected: { date: "2026-07-20", intake: 1500, weight: "", protein: "", water: "" } },
    { name: "no header explicit zero", text: "2026-07-20,1500,0,0,0", expected: { date: "2026-07-20", intake: 1500, weight: 0, protein: 0, water: 0 } }
  ];
  for (const sample of csvRoundTrips) {
    const parsed = instance.api.parseImportRows(sample.text);
    assert.equal(parsed.errors.length, 0, `${file}: ${sample.name} has no errors`);
    const rec = parsed.records[0];
    assert.deepEqual({ date: rec.date, intake: rec.intake, weight: rec.weight, protein: rec.protein, water: rec.water }, sample.expected, `${file}: ${sample.name} round-trips exactly`);
  }

  const adversarialSamples = [
    { name: "time ignored", text: "2026-07-20 12:30 1500 70 60 2000", expected: { intake: 1500, weight: 70, protein: 60, water: 2000 } },
    { name: "time with seconds ignored", text: "2026-07-20 12:30:45 1500", expected: { intake: 1500, weight: "", protein: "", water: "" } },
    { name: "percentage ignored", text: "2026-07-20 1500 体脂率20% 70kg", expected: { intake: 1500, weight: 70, protein: "", water: "" } },
    { name: "note before labeled intake", text: "2026-07-20 吃了3个鸡蛋 1500大卡", expected: { intake: 1500, weight: "", protein: "", water: "" } },
    { name: "units attached", text: "2026-07-20 1500大卡 70kg 60g 2000ml", expected: { intake: 1500, weight: 70, protein: 60, water: 2000 } },
    { name: "labeled intake then positional", text: "2026-07-20 1500大卡 70 60 2000", expected: { intake: 1500, weight: 70, protein: 60, water: 2000 } },
    { name: "Chinese punctuation", text: "2026年7月20日，1500大卡，体重70kg，蛋白质60g，饮水2000ml", expected: { intake: 1500, weight: 70, protein: 60, water: 2000 } },
    { name: "tab separated", text: "2026-07-20\t1500\t70\t60\t2000", expected: { intake: 1500, weight: 70, protein: 60, water: 2000 } }
  ];
  for (const sample of adversarialSamples) {
    const parsed = instance.api.parseImportRows(sample.text);
    assert.equal(parsed.errors.length, 0, `${file}: ${sample.name} has no errors`);
    const rec = parsed.records[0];
    assert.deepEqual({ intake: rec.intake, weight: rec.weight, protein: rec.protein, water: rec.water }, sample.expected, `${file}: ${sample.name} parses conservatively`);
  }



  const progressInstance = app(file, clock, {});
  progressInstance.api.setDailyTargets({ intake: "", protein: "", height: "", water: 1500 });
  progressInstance.context.document.querySelector("#waterInput").value = "750";
  progressInstance.api.renderTargetProgress();
  const progressHtml = progressInstance.context.document.querySelector("#targetProgress").innerHTML;
  assert.match(progressHtml, /饮水达成度/, `${file}: live target progress includes water`);
  assert.match(progressHtml, /50%/, `${file}: live target progress reflects water ratio`);
  const policyCheck = progressInstance.api.metricTargetStatus("饮水", 750, 1500, "ml");
  assert.equal(policyCheck.policy, "minimum", `${file}: metric policy is explicit`);
  assert.equal(policyCheck.level, "low", `${file}: minimum policy keeps current behavior`);



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

  const secondCorrupt = '"not-array"';
  instance = app(file, clock, {
    dailyDietRecordsV1: secondCorrupt,
    dailyDietRecordsV1CorruptBackupV1: "OLD_RAW"
  });
  instance.api.loadRecords();
  assert.equal(instance.api.saveRecords(), true, `${file}: different second corruption still saves via archive`);
  assert.equal(instance.storage.dailyDietRecordsV1CorruptBackupV1, "OLD_RAW", `${file}: never overwrites existing raw backup`);
  const archive = JSON.parse(instance.storage.dailyDietRecordsV1CorruptBackupV2);
  assert.equal(archive.length, 1, `${file}: archives second corruption`);
  assert.equal(archive[0].raw, secondCorrupt, `${file}: archived raw content is exact`);

  const backup = {
    schemaVersion: 1,
    records: [{ date: "2026-08-01", intake: 2200, weight: 70, protein: 120, water: 2000 }],
    targets: { intake: 2500, protein: 120, height: 170, water: 2000 },
    preferences: { theme: "dark" }
  };
  const originalRecordsJson = JSON.stringify([{ date: "2026-07-20", intake: 1500, weight: "", protein: "", water: "" }]);
  const originalTargetsJson = JSON.stringify({ intake: 2000, protein: "", height: "", water: "" });
  function makeBackupInstance() {
    const inst = app(file, clock, {
      dailyDietRecordsV1: originalRecordsJson,
      dailyDietTargetsV1: originalTargetsJson,
      dailyDietThemeV1: "light"
    });
    inst.api.loadRecords();
    inst.api.loadTargets();
    inst.context.applyTheme("light");
    return inst;
  }
  function assertRestoreRolledBack(inst, label) {
    assert.equal(inst.api.restoreFullBackup(backup), false, `${file}: ${label} returns false`);
    assert.deepEqual(JSON.parse(inst.storage.dailyDietRecordsV1), JSON.parse(originalRecordsJson), `${file}: ${label} restores persisted records`);
    assert.equal(inst.storage.dailyDietTargetsV1, originalTargetsJson, `${file}: ${label} restores persisted targets`);
    assert.equal(inst.storage.dailyDietThemeV1, "light", `${file}: ${label} restores persisted theme`);
    assert.deepEqual(JSON.parse(JSON.stringify(inst.api.getSortedRecords())), JSON.parse(originalRecordsJson), `${file}: ${label} restores memory records`);
    assert.deepEqual(JSON.parse(JSON.stringify(inst.api.getDailyTargets())), JSON.parse(originalTargetsJson), `${file}: ${label} restores memory targets`);
    assert.equal(inst.context.document.documentElement.getAttribute("data-theme"), "light", `${file}: ${label} restores DOM theme`);
    assert.equal(inst.storage.dailyDietRestoreJournalV1, undefined, `${file}: ${label} removes journal after clean rollback`);
  }

  let backupInstance = makeBackupInstance();
  backupInstance.storage.__throwSet = "dailyDietRecordsV1";
  assertRestoreRolledBack(backupInstance, "records write failure");

  backupInstance = makeBackupInstance();
  backupInstance.storage.__throwSet = "dailyDietTargetsV1";
  assertRestoreRolledBack(backupInstance, "targets write failure");

  backupInstance = makeBackupInstance();
  backupInstance.storage.__throwSet = "dailyDietThemeV1";
  assertRestoreRolledBack(backupInstance, "theme write failure");

  backupInstance = makeBackupInstance();
  backupInstance.storage.__throwSet = "dailyDietThemeV1";
  backupInstance.storage.__failAfterSet = { dailyDietRecordsV1: 1 };
  assert.equal(backupInstance.api.restoreFullBackup(backup), false, `${file}: rollback write failure returns false`);
  assert.deepEqual(JSON.parse(JSON.stringify(backupInstance.api.getSortedRecords())), JSON.parse(originalRecordsJson), `${file}: rollback write failure restores memory records`);
  assert.deepEqual(JSON.parse(JSON.stringify(backupInstance.api.getDailyTargets())), JSON.parse(originalTargetsJson), `${file}: rollback write failure restores memory targets`);
  assert.equal(backupInstance.context.document.documentElement.getAttribute("data-theme"), "light", `${file}: rollback write failure restores DOM theme`);
  assert.ok(backupInstance.storage.dailyDietRestoreJournalV1, `${file}: rollback write failure keeps recovery journal`);

  const storageFailureCases = [
    { name: "SecurityError" },
    { name: "QuotaExceededError" },
    { name: "GenericError" }
  ];
  for (const failure of storageFailureCases) {
    const errorName = failure.name === "GenericError" ? undefined : failure.name;

    let failureInstance = app(file, clock, {});
    failureInstance.api.loadRecords();
    failureInstance.storage.__throwName = errorName;
    failureInstance.storage.__throwSet = "dailyDietRecordsV1";
    failureInstance.api.recordsByDate.set("2026-07-27", { date: "2026-07-27", intake: 900, weight: "", protein: "", water: "" });
    assert.equal(failureInstance.api.saveRecords(), false, `${file}: ${failure.name} records save fails`);
    failureInstance.api.renderStorageStatus();
    if (failure.name === "SecurityError") {
      assert.equal(failureInstance.api.getStorageUnavailable(), true, `${file}: ${failure.name} marks storage unavailable`);
      assert.equal(failureInstance.context.document.querySelector("#storageWarning").hidden, false, `${file}: ${failure.name} shows storage warning`);
    } else {
      assert.equal(failureInstance.api.getStorageUnavailable(), false, `${file}: ${failure.name} does not mark storage unavailable`);
      assert.equal(failureInstance.context.document.querySelector("#storageWarning").hidden, true, `${file}: ${failure.name} does not show permanent warning`);
    }

    failureInstance = app(file, clock, {});
    failureInstance.api.loadTargets();
    failureInstance.storage.__throwName = errorName;
    failureInstance.storage.__throwSet = "dailyDietTargetsV1";
    assert.equal(failureInstance.api.writeTargets({ intake: 2000, protein: "", height: "", water: "" }), false, `${file}: ${failure.name} targets save fails`);

    failureInstance = app(file, clock, {});
    failureInstance.storage.__throwName = errorName;
    failureInstance.storage.__throwSet = "dailyDietThemeV1";
    assert.notEqual(failureInstance.api.storageSet("dailyDietThemeV1", "dark"), true, `${file}: ${failure.name} theme save does not claim success`);

    failureInstance = makeBackupInstance();
    failureInstance.storage.__throwName = errorName;
    failureInstance.storage.__throwSet = "dailyDietRecordsV1";
    assertRestoreRolledBack(failureInstance, `${failure.name} full-backup records failure`);
  }


  let schemaInstance = makeBackupInstance();
  assert.equal(schemaInstance.api.restoreFullBackup(backup), true, `${file}: current full backup restores`);
  assert.deepEqual(JSON.parse(JSON.stringify(schemaInstance.api.getSortedRecords())), backup.records, `${file}: current full backup records applied`);
  assert.deepEqual(JSON.parse(JSON.stringify(schemaInstance.api.getDailyTargets())), backup.targets, `${file}: current full backup targets applied`);

  schemaInstance = makeBackupInstance();
  assert.equal(schemaInstance.api.restoreFullBackup({ ...backup, schemaVersion: undefined }), true, `${file}: missing schemaVersion is accepted as current`);
  schemaInstance = makeBackupInstance();
  assert.equal(schemaInstance.api.restoreFullBackup({ ...backup, targets: undefined }), true, `${file}: missing targets defaults safely`);
  schemaInstance = makeBackupInstance();
  assert.equal(schemaInstance.api.restoreFullBackup({ ...backup, preferences: undefined }), true, `${file}: missing preferences defaults safely`);
  assert.equal(schemaInstance.context.document.documentElement.getAttribute("data-theme"), "light", `${file}: missing preferences keeps light theme`);
  schemaInstance = makeBackupInstance();
  assert.equal(schemaInstance.api.restoreFullBackup({ ...backup, targets: "bad" }), true, `${file}: malformed targets defaults safely`);
  assert.deepEqual(JSON.parse(JSON.stringify(schemaInstance.api.getDailyTargets())), { intake: "", protein: "", height: "", water: "" }, `${file}: malformed targets become empty`);
  schemaInstance = makeBackupInstance();
  assert.equal(schemaInstance.api.restoreFullBackup({ ...backup, preferences: { theme: "blue" } }), true, `${file}: invalid theme falls back to light`);
  assert.equal(schemaInstance.context.document.documentElement.getAttribute("data-theme"), "light", `${file}: invalid theme is not applied`);
  schemaInstance = makeBackupInstance();
  assert.equal(schemaInstance.api.restoreFullBackup({ schemaVersion: 999, records: backup.records }), false, `${file}: unsupported schemaVersion is rejected`);
  assert.deepEqual(JSON.parse(JSON.stringify(schemaInstance.api.getSortedRecords())), JSON.parse(originalRecordsJson), `${file}: unsupported schemaVersion changes nothing`);
  assert.deepEqual(JSON.parse(JSON.stringify(schemaInstance.api.getDailyTargets())), JSON.parse(originalTargetsJson), `${file}: unsupported schemaVersion keeps targets`);
  assert.equal(schemaInstance.context.document.documentElement.getAttribute("data-theme"), "light", `${file}: unsupported schemaVersion keeps theme`);

  function makePendingJournalInstance(failRecovery) {
    const partialRecords = JSON.stringify([{ date: "2026-08-01", intake: 2000, weight: "", protein: "", water: "" }]);
    const partialTargets = JSON.stringify({ intake: 2500, protein: "", height: "", water: "" });
    const inst = app(file, clock, {
      dailyDietRecordsV1: partialRecords,
      dailyDietTargetsV1: partialTargets,
      dailyDietThemeV1: "dark",
      dailyDietRestoreJournalV1: JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        records: originalRecordsJson,
        targets: originalTargetsJson,
        theme: "light"
      })
    });
    inst.api.loadRecords();
    inst.api.loadTargets();
    inst.context.applyTheme("dark");
    if (failRecovery) {
      inst.storage.__throwSet = ["dailyDietRecordsV1", "dailyDietTargetsV1", "dailyDietThemeV1"];
    }
    return inst;
  }

  let pendingJournal = makePendingJournalInstance(true);
  assert.equal(pendingJournal.api.recoverRestoreJournal(), false, `${file}: repeated recovery failure returns false`);
  assert.equal(pendingJournal.api.getRestoreRecoveryPending(), true, `${file}: repeated recovery failure marks pending`);
  assert.ok(pendingJournal.storage.dailyDietRestoreJournalV1, `${file}: repeated recovery failure keeps journal`);
  assert.equal(pendingJournal.api.saveRecords(), false, `${file}: pending journal blocks record save`);
  assert.equal(pendingJournal.api.writeTargets({ intake: 1, protein: "", height: "", water: "" }), false, `${file}: pending journal blocks target save`);
  assert.equal(pendingJournal.api.restoreFullBackup(backup), false, `${file}: pending journal blocks full-backup restore`);
  assert.equal(pendingJournal.api.storageSet("dailyDietThemeV1", "light"), false, `${file}: pending journal blocks theme persistence`);
  assert.equal(pendingJournal.api.applyRecordMutationAndSave(() => {
    pendingJournal.api.recordsByDate.set("2026-09-01", { date: "2026-09-01", intake: 1, weight: "", protein: "", water: "" });
  }), false, `${file}: pending journal blocks record mutation transaction`);
  assert.ok(pendingJournal.storage.dailyDietRestoreJournalV1, `${file}: mutation attempts do not discard journal`);
  pendingJournal.api.renderStorageStatus();
  assert.match(pendingJournal.context.document.querySelector("#storageWarning").textContent, /恢复日志/, `${file}: pending journal warning is visible`);

  let recoveredJournal = makePendingJournalInstance(false);
  assert.equal(recoveredJournal.api.recoverRestoreJournal(), true, `${file}: recovery success returns true`);
  assert.equal(recoveredJournal.api.getRestoreRecoveryPending(), false, `${file}: recovery success clears pending`);
  assert.equal(recoveredJournal.storage.dailyDietRestoreJournalV1, undefined, `${file}: recovery success removes journal`);
  assert.deepEqual(JSON.parse(recoveredJournal.storage.dailyDietRecordsV1), JSON.parse(originalRecordsJson), `${file}: recovery success restores records`);
  assert.equal(recoveredJournal.storage.dailyDietTargetsV1, originalTargetsJson, `${file}: recovery success restores targets`);
  assert.equal(recoveredJournal.storage.dailyDietThemeV1, "light", `${file}: recovery success restores theme`);
  assert.deepEqual(JSON.parse(JSON.stringify(recoveredJournal.api.getSortedRecords())), JSON.parse(originalRecordsJson), `${file}: recovery success reloads records`);
  assert.deepEqual(JSON.parse(JSON.stringify(recoveredJournal.api.getDailyTargets())), JSON.parse(originalTargetsJson), `${file}: recovery success reloads targets`);
  assert.equal(recoveredJournal.context.document.documentElement.getAttribute("data-theme"), "light", `${file}: recovery success applies recovered theme`);
  assert.equal(recoveredJournal.api.saveRecords(), true, `${file}: normal persistence works after recovery`);

  let malformedJournal = makePendingJournalInstance(false);
  malformedJournal.storage.dailyDietRestoreJournalV1 = "{not-json";
  assert.equal(malformedJournal.api.recoverRestoreJournal(), false, `${file}: malformed journal fails safely`);
  assert.equal(malformedJournal.api.getRestoreRecoveryPending(), true, `${file}: malformed journal marks pending`);
  assert.equal(malformedJournal.api.saveRecords(), false, `${file}: malformed journal blocks saves`);
  assert.ok(malformedJournal.storage.dailyDietRestoreJournalV1, `${file}: malformed journal is preserved`);

  let badSchemaJournal = makePendingJournalInstance(false);
  badSchemaJournal.storage.dailyDietRestoreJournalV1 = JSON.stringify({ schemaVersion: 999, records: "x", targets: "y", theme: "z" });
  assert.equal(badSchemaJournal.api.recoverRestoreJournal(), false, `${file}: bad schema journal fails safely`);
  assert.equal(badSchemaJournal.api.getRestoreRecoveryPending(), true, `${file}: bad schema journal marks pending`);
  assert.equal(badSchemaJournal.api.saveRecords(), false, `${file}: bad schema journal blocks saves`);
  assert.ok(badSchemaJournal.storage.dailyDietRestoreJournalV1, `${file}: bad schema journal is preserved`);




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
