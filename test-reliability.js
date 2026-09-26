const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function app(file, clock, storage = {}, contextExtras = {}) {
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
  function storageRemoveError(key) {
    if (storage.__throwRemove === key) return true;
    if (Array.isArray(storage.__throwRemove) && storage.__throwRemove.includes(key)) return true;
    return storageError(key);
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
      removeItem(key) { if (storageRemoveError(key)) throw makeStorageError(); delete storage[key]; }
    },
    confirm() { return true; },
    location: { protocol: "http:" },
    applyTheme(theme) { documentElement.setAttribute("data-theme", theme); },
    THEME_KEY: "dailyDietThemeV1"
  };
  Object.assign(context, contextExtras);
  vm.createContext(context);
  vm.runInContext(`${script.slice(0, cut)}; globalThis.test = { loadRecords, loadTargets, saveRecords, getSortedRecords, consecutiveRecordDays, refreshToday, makeIntakeOverview, movingAverage, groupRecordsByCalendarWeek, parseImportRows, findDuplicateDates, applyRecordMutationAndSave, recordsByDate, renderTargetProgress, metricTargetStatus, restoreFullBackup, normalizeTargetsObject, writeStorageDirect, setDailyTargets: (targets) => { dailyTargets = targets; }, getDailyTargets: () => ({ ...dailyTargets }), renderStorageStatus, getStorageUnavailable: () => storageUnavailable, writeTargets, saveTargets, storageSet, recoverRestoreJournal, ensureRestoreRecovery, importInitialRecords: typeof importInitialRecords === "function" ? importInitialRecords : undefined, persistThemeToggle, isValidRestoreJournal, getRestoreRecoveryPending: () => restoreRecoveryPending, getState: () => ({ today, selectedDate, calendarYear, calendarMonth }) };`, context);
  return { api: context.test, storage, context };
}

(async () => {
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

  // 跨窗口同步：另一标签页的写入不得被本标签页的陈旧快照覆盖，删除不得被复活
  const sharedStorage = {};
  const windowA = app(file, clock, sharedStorage);
  const windowB = app(file, clock, sharedStorage);
  windowA.api.loadRecords();
  windowB.api.loadRecords();
  windowB.api.applyRecordMutationAndSave(() => windowB.api.recordsByDate.set("2026-07-20", { date: "2026-07-20", intake: 900, weight: "", protein: "", water: "" }));
  windowA.api.applyRecordMutationAndSave(() => windowA.api.recordsByDate.set("2026-07-21", { date: "2026-07-21", intake: 800, weight: "", protein: "", water: "" }));
  const sharedFinal = JSON.parse(sharedStorage.dailyDietRecordsV1);
  assert.ok(sharedFinal.some((r) => r.date === "2026-07-20" && r.intake === 900), `${file}: cross-tab added record survives other window's save`);
  assert.ok(sharedFinal.some((r) => r.date === "2026-07-21" && r.intake === 800), `${file}: local mutation still applies after external write`);
  windowB.api.applyRecordMutationAndSave(() => windowB.api.recordsByDate.delete("2026-07-21"));
  windowA.api.applyRecordMutationAndSave(() => windowA.api.recordsByDate.set("2026-07-22", { date: "2026-07-22", intake: 700, weight: "", protein: "", water: "" }));
  const sharedAfterDelete = JSON.parse(sharedStorage.dailyDietRecordsV1);
  assert.ok(!sharedAfterDelete.some((r) => r.date === "2026-07-21"), `${file}: cross-tab deletion is not resurrected by stale snapshot`);
  assert.ok(sharedAfterDelete.some((r) => r.date === "2026-07-22"), `${file}: addition after external delete still lands`);

  // Web Locks 互斥路径：两个窗口从同一基线“同时”发起保存（两次调用都不等待），
  // 锁把两次 read-modify-write 串行化，最终两条记录都必须存在
  const lockChains = {};
  const makeLockContext = () => ({
    navigator: {
      locks: {
        request(name, callback) {
          lockChains[name] = (lockChains[name] || Promise.resolve()).then(() => Promise.resolve().then(callback));
          return lockChains[name];
        }
      }
    }
  });
  const lockStorage = {};
  const lockedA = app(file, clock, lockStorage, makeLockContext());
  const lockedB = app(file, clock, lockStorage, makeLockContext());
  lockedA.api.loadRecords();
  lockedB.api.loadRecords();
  const pendingA = lockedA.api.applyRecordMutationAndSave(() => lockedA.api.recordsByDate.set("2026-07-20", { date: "2026-07-20", intake: 900, weight: "", protein: "", water: "" }));
  const pendingB = lockedB.api.applyRecordMutationAndSave(() => lockedB.api.recordsByDate.set("2026-07-21", { date: "2026-07-21", intake: 800, weight: "", protein: "", water: "" }));
  assert.equal(typeof pendingA.then, "function", `${file}: locked path returns a promise`);
  await Promise.all([pendingA, pendingB]);
  const lockedFinal = JSON.parse(lockStorage.dailyDietRecordsV1);
  assert.ok(lockedFinal.some((r) => r.date === "2026-07-20" && r.intake === 900), `${file}: simultaneous save keeps A's record`);
  assert.ok(lockedFinal.some((r) => r.date === "2026-07-21" && r.intake === 800), `${file}: simultaneous save keeps B's record`);

  // targets 锁：并发保存时后写入者发现基线变化被阻止并得到解释
  const targetsLockStorage = {};
  const targetsLockChains = {};
  const makeTargetsLockContext = () => ({
    navigator: {
      locks: {
        request(name, callback) {
          targetsLockChains[name] = (targetsLockChains[name] || Promise.resolve()).then(() => Promise.resolve().then(callback));
          return targetsLockChains[name];
        }
      }
    }
  });
  const targetsOwnerA = app(file, clock, targetsLockStorage, makeTargetsLockContext());
  const targetsOwnerB = app(file, clock, targetsLockStorage, makeTargetsLockContext());
  targetsOwnerA.api.loadTargets();
  targetsOwnerB.api.loadTargets();
  targetsOwnerA.context.document.querySelector("#targetIntakeInput").value = "2100";
  targetsOwnerB.context.document.querySelector("#targetIntakeInput").value = "2200";
  await Promise.all([
    targetsOwnerA.api.saveTargets(),
    targetsOwnerB.api.saveTargets()
  ]);
  const storedTargetsIntake = JSON.parse(targetsLockStorage.dailyDietTargetsV1).intake;
  assert.ok(storedTargetsIntake === 2100 || storedTargetsIntake === 2200, `${file}: simultaneous target saves keep one coherent value`);
  const targetsMsgA = targetsOwnerA.context.document.querySelector("#targetMessage").textContent;
  const targetsMsgB = targetsOwnerB.context.document.querySelector("#targetMessage").textContent;
  assert.ok(
    (storedTargetsIntake === 2100 && /另一个窗口/.test(targetsMsgB)) || (storedTargetsIntake === 2200 && /另一个窗口/.test(targetsMsgA)),
    `${file}: loser of simultaneous target save gets conflict notice`
  );

  // 目标跨窗口覆盖防护：表单种子之后持久化值被外部改写时，保存被阻止并刷新
  const targetsStorage = {};
  const targetsOwner = app(file, clock, targetsStorage);
  targetsOwner.api.loadTargets();
  targetsOwner.context.document.querySelector("#targetIntakeInput").value = "2000";
  targetsOwner.api.saveTargets();
  assert.deepEqual(JSON.parse(targetsStorage.dailyDietTargetsV1), { intake: 2000, protein: "", height: "", water: "" }, `${file}: targets save writes form values`);
  const otherWindow = app(file, clock, targetsStorage);
  otherWindow.api.loadTargets();
  assert.equal(otherWindow.api.writeTargets({ intake: 2500, protein: "", height: "", water: "" }), true, `${file}: other window writes targets`);
  targetsOwner.context.document.querySelector("#targetIntakeInput").value = "2100";
  targetsOwner.api.saveTargets();
  assert.deepEqual(JSON.parse(targetsStorage.dailyDietTargetsV1), { intake: 2500, protein: "", height: "", water: "" }, `${file}: stale target save is blocked by cross-window guard`);
  assert.match(targetsOwner.context.document.querySelector("#targetMessage").textContent, /另一个窗口/, `${file}: cross-window target conflict explains itself`);
  targetsOwner.api.loadTargets();
  targetsOwner.api.saveTargets();
  assert.deepEqual(JSON.parse(targetsStorage.dailyDietTargetsV1), { intake: 2500, protein: "", height: "", water: "" }, `${file}: refreshed form re-saves latest values`);

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


  let removeFailBackup = makeBackupInstance();
  removeFailBackup.storage.__throwRemove = "dailyDietRestoreJournalV1";
  assert.equal(removeFailBackup.api.restoreFullBackup(backup), false, `${file}: full backup with journal-removal failure returns false`);
  assert.equal(removeFailBackup.api.getRestoreRecoveryPending(), true, `${file}: full backup with journal-removal failure keeps recovery pending`);
  assert.ok(removeFailBackup.storage.dailyDietRestoreJournalV1, `${file}: full backup with journal-removal failure preserves journal`);
  assert.deepEqual(JSON.parse(removeFailBackup.storage.dailyDietRecordsV1), JSON.parse(originalRecordsJson), `${file}: full backup with journal-removal failure rolls records back to old state`);
  assert.equal(removeFailBackup.storage.dailyDietTargetsV1, originalTargetsJson, `${file}: full backup with journal-removal failure rolls targets back to old state`);
  assert.equal(removeFailBackup.storage.dailyDietThemeV1, "light", `${file}: full backup with journal-removal failure rolls theme back to old state`);
  assert.equal(removeFailBackup.api.applyRecordMutationAndSave(() => {
    removeFailBackup.api.recordsByDate.set("2026-09-01", { date: "2026-09-01", intake: 1, weight: "", protein: "", water: "" });
  }), false, `${file}: stale journal from failed full backup blocks record mutation`);
  assert.equal(removeFailBackup.api.writeTargets({ intake: 1, protein: "", height: "", water: "" }), false, `${file}: stale journal from failed full backup blocks target save`);
  assert.equal(removeFailBackup.api.storageSet("dailyDietThemeV1", "dark"), false, `${file}: stale journal from failed full backup blocks theme persistence`);
  assert.equal(removeFailBackup.api.restoreFullBackup(backup), false, `${file}: stale journal from failed full backup blocks another restore`);
  assert.ok(removeFailBackup.storage.dailyDietRestoreJournalV1, `${file}: stale journal from failed full backup remains intact`);
  removeFailBackup.storage.__throwRemove = undefined;
  assert.equal(removeFailBackup.api.recoverRestoreJournal(), true, `${file}: failed full backup recovery can finalize after removeItem is available`);
  assert.equal(removeFailBackup.api.getRestoreRecoveryPending(), false, `${file}: failed full backup recovery clears pending after finalize`);
  assert.equal(removeFailBackup.storage.dailyDietRestoreJournalV1, undefined, `${file}: failed full backup recovery removes journal after finalize`);
  assert.equal(removeFailBackup.api.saveRecords(), true, `${file}: normal persistence works after failed full backup finalizes`);

  let removeFailRecovery = makePendingJournalInstance(false);
  removeFailRecovery.storage.__throwRemove = "dailyDietRestoreJournalV1";
  assert.equal(removeFailRecovery.api.recoverRestoreJournal(), false, `${file}: journal recovery with removal failure returns false`);
  assert.equal(removeFailRecovery.api.getRestoreRecoveryPending(), true, `${file}: journal recovery with removal failure keeps recovery pending`);
  assert.ok(removeFailRecovery.storage.dailyDietRestoreJournalV1, `${file}: journal recovery with removal failure preserves journal`);
  assert.equal(removeFailRecovery.api.applyRecordMutationAndSave(() => {
    removeFailRecovery.api.recordsByDate.set("2026-09-01", { date: "2026-09-01", intake: 1, weight: "", protein: "", water: "" });
  }), false, `${file}: unresolved journal recovery blocks record mutation`);
  assert.equal(removeFailRecovery.api.writeTargets({ intake: 1, protein: "", height: "", water: "" }), false, `${file}: unresolved journal recovery blocks target save`);
  assert.equal(removeFailRecovery.api.storageSet("dailyDietThemeV1", "dark"), false, `${file}: unresolved journal recovery blocks theme persistence`);
  assert.equal(removeFailRecovery.api.restoreFullBackup(backup), false, `${file}: unresolved journal recovery blocks another restore`);
  assert.ok(removeFailRecovery.storage.dailyDietRestoreJournalV1, `${file}: unresolved journal recovery remains intact`);
  removeFailRecovery.storage.__throwRemove = undefined;
  assert.equal(removeFailRecovery.api.recoverRestoreJournal(), true, `${file}: journal recovery can finalize after removeItem is available`);
  assert.equal(removeFailRecovery.api.getRestoreRecoveryPending(), false, `${file}: journal recovery clears pending after finalize`);
  assert.equal(removeFailRecovery.storage.dailyDietRestoreJournalV1, undefined, `${file}: journal recovery removes journal after finalize`);
  assert.deepEqual(JSON.parse(removeFailRecovery.storage.dailyDietRecordsV1), JSON.parse(originalRecordsJson), `${file}: journal recovery finalizes records`);
  assert.equal(removeFailRecovery.api.saveRecords(), true, `${file}: normal persistence works after journal recovery finalizes`);

  // —— 恢复 / 日志恢复与普通写入的互斥（统一 nutriflow-data-v1-write 锁）——
  const makeRestoreLockStub = () => {
    const chains = {};
    return {
      context: () => ({
        navigator: {
          locks: {
            request(name, callback) {
              chains[name] = (chains[name] || Promise.resolve()).then(() => Promise.resolve().then(callback));
              return chains[name];
            }
          }
        }
      }),
      chain: (name) => chains[name]
    };
  };
  const DATA_WRITE_LOCK_NAME = "nutriflow-data-v1-write";

  const rgFinalProbe = (storage) => {
    const records = JSON.parse(storage.dailyDietRecordsV1);
    return records.some((r) => r.date === "2026-08-01");
  };

  // 1) 恢复与普通保存同时发起：串行化后终态必须是完整串行顺序（恢复单元整体生效，保存落在其上）
  const rsLock = makeRestoreLockStub();
  const rsStorage = {};
  const restoreFirst = app(file, clock, rsStorage, rsLock.context());
  const saveSecond = app(file, clock, rsStorage, rsLock.context());
  restoreFirst.api.loadRecords();
  restoreFirst.api.loadTargets();
  saveSecond.api.loadRecords();
  saveSecond.api.loadTargets();
  const restorePending = restoreFirst.api.restoreFullBackup(backup);
  const savePending = saveSecond.api.applyRecordMutationAndSave(() => saveSecond.api.recordsByDate.set("2026-07-21", { date: "2026-07-21", intake: 800, weight: "", protein: "", water: "" }));
  assert.equal(await restorePending, true, `${file}: concurrent restore succeeds`);
  assert.equal(await savePending, true, `${file}: concurrent save succeeds`);
  const rsFinalRecords = JSON.parse(rsStorage.dailyDietRecordsV1);
  assert.deepEqual(JSON.parse(rsStorage.dailyDietTargetsV1), backup.targets, `${file}: restore applies targets as a unit`);
  assert.ok(backup.records.every((r) => rsFinalRecords.some((x) => x.date === r.date && x.intake === r.intake)), `${file}: restore applies records as a unit`);
  assert.ok(rsFinalRecords.every((r) => r.date === "2026-07-21" || backup.records.some((x) => x.date === r.date)), `${file}: final state matches one complete serial order`);
  assert.ok(!rsStorage.dailyDietRestoreJournalV1, `${file}: successful restore leaves no journal`);

  // 2) 恢复中途失败回滚与普通保存同时发起：回滚先完成，随后普通保存落在回滚后状态上并幸存
  const rbLock = makeRestoreLockStub();
  const rbStorage = {};
  const restoreFails = app(file, clock, rbStorage, rbLock.context());
  const saveQueued = app(file, clock, rbStorage, rbLock.context());
  restoreFails.api.loadRecords();
  restoreFails.api.loadTargets();
  saveQueued.api.loadRecords();
  saveQueued.api.loadTargets();
  rbStorage.__throwSet = "dailyDietTargetsV1"; // 恢复的 targets 写入失败 → 触发完整回滚
  const failedRestorePending = restoreFails.api.restoreFullBackup(backup);
  // 恢复的锁回调结束后、排队的普通保存开始前解除注入（锁链保证顺序）
  rbLock.chain(DATA_WRITE_LOCK_NAME).then(() => { delete rbStorage.__throwSet; });
  const queuedSavePending = saveQueued.api.applyRecordMutationAndSave(() => saveQueued.api.recordsByDate.set("2026-07-21", { date: "2026-07-21", intake: 800, weight: "", protein: "", water: "" }));
  assert.equal(await failedRestorePending, false, `${file}: restore with failing targets write reports failure`);
  assert.equal(await queuedSavePending, true, `${file}: queued normal save succeeds after failed restore's rollback`);
  const rbFinalRecords = JSON.parse(rbStorage.dailyDietRecordsV1);
  assert.ok(rbFinalRecords.some((r) => r.date === "2026-07-21" && r.intake === 800), `${file}: rollback does not wipe concurrently saved record`);
  assert.ok(!rbFinalRecords.some((r) => r.date === "2026-08-01"), `${file}: failed restore leaves no restored records`);
  assert.ok(!rbStorage.dailyDietRestoreJournalV1, `${file}: rollback after cleared injection removes journal`);

  // 3) 日志恢复与普通保存同时发起：恢复先完成，普通保存落在恢复后状态上并幸存
  const rcLock = makeRestoreLockStub();
  const rcStorage = {
    dailyDietRecordsV1: JSON.stringify([{ date: "2026-08-01", intake: 2000, weight: "", protein: "", water: "" }]),
    dailyDietTargetsV1: JSON.stringify({ intake: 2500, protein: "", height: "", water: "" }),
    dailyDietThemeV1: "dark",
    dailyDietRestoreJournalV1: JSON.stringify({
      schemaVersion: 1,
      records: originalRecordsJson,
      targets: originalTargetsJson,
      theme: "light"
    })
  };
  const recoveryTab = app(file, clock, rcStorage, rcLock.context());
  const saveTabRc = app(file, clock, rcStorage, rcLock.context());
  recoveryTab.api.loadRecords();
  recoveryTab.api.loadTargets();
  saveTabRc.api.loadRecords();
  saveTabRc.api.loadTargets();
  const recoveryPending = recoveryTab.api.recoverRestoreJournal();
  const saveAfterRecoveryPending = saveTabRc.api.applyRecordMutationAndSave(() => saveTabRc.api.recordsByDate.set("2026-07-21", { date: "2026-07-21", intake: 800, weight: "", protein: "", water: "" }));
  assert.equal(await recoveryPending, true, `${file}: journal recovery succeeds under lock`);
  assert.equal(await saveAfterRecoveryPending, true, `${file}: normal save after recovery succeeds`);
  assert.ok(!rcStorage.dailyDietRestoreJournalV1, `${file}: recovery removes journal under lock`);
  const rcFinalRecords = JSON.parse(rcStorage.dailyDietRecordsV1);
  assert.ok(rcFinalRecords.some((r) => r.date === "2026-07-20" && r.intake === 1500), `${file}: recovery restores journaled records`);
  assert.ok(rcFinalRecords.some((r) => r.date === "2026-07-21" && r.intake === 800), `${file}: normal save survives journal recovery`);
  assert.ok(!rcFinalRecords.some((r) => r.date === "2026-08-01"), `${file}: journal recovery replaces partial restored state`);

  // 4) 跨窗口遗留日志防护：普通保存发现遗留日志时先恢复，再应用本次变更
  const staleStorage = {
    dailyDietRecordsV1: JSON.stringify([{ date: "2026-08-01", intake: 2000, weight: "", protein: "", water: "" }]),
    dailyDietTargetsV1: JSON.stringify({ intake: 2500, protein: "", height: "", water: "" }),
    dailyDietThemeV1: "dark",
    dailyDietRestoreJournalV1: JSON.stringify({
      schemaVersion: 1,
      records: originalRecordsJson,
      targets: originalTargetsJson,
      theme: "light"
    })
  };
  const staleTab = app(file, clock, staleStorage);
  staleTab.api.loadRecords();
  staleTab.api.loadTargets();
  assert.equal(
    await staleTab.api.applyRecordMutationAndSave(() => staleTab.api.recordsByDate.set("2026-07-21", { date: "2026-07-21", intake: 800, weight: "", protein: "", water: "" })),
    true,
    `${file}: gated save with stale journal succeeds`
  );
  assert.ok(!staleStorage.dailyDietRestoreJournalV1, `${file}: gated save consumes stale journal`);
  const staleFinalRecords = JSON.parse(staleStorage.dailyDietRecordsV1);
  assert.ok(staleFinalRecords.some((r) => r.date === "2026-07-20" && r.intake === 1500), `${file}: gated save lands on recovered records`);
  assert.ok(staleFinalRecords.some((r) => r.date === "2026-07-21" && r.intake === 800), `${file}: gated save applies its own mutation`);

  // 5) targets 遗留日志防护：gate 恢复会改写基线，恢复前冻结的表单基线必须仍判 stale
  const stgLock = makeRestoreLockStub();
  const stgStorage = {
    dailyDietRecordsV1: JSON.stringify([]),
    dailyDietTargetsV1: JSON.stringify({ intake: 2500, protein: "", height: "", water: "" }),
    dailyDietThemeV1: "light",
    dailyDietRestoreJournalV1: JSON.stringify({
      schemaVersion: 1,
      records: JSON.stringify([]),
      targets: JSON.stringify({ intake: 1500, protein: "", height: "", water: "" }),
      theme: "light"
    })
  };
  const staleTargetsLocked = app(file, clock, stgStorage, stgLock.context());
  staleTargetsLocked.api.loadTargets();
  staleTargetsLocked.context.document.querySelector("#targetIntakeInput").value = "2100";
  assert.equal(await staleTargetsLocked.api.saveTargets(), false, `${file}: targets save across stale-journal recovery is judged stale and blocked`);
  assert.deepEqual(JSON.parse(stgStorage.dailyDietTargetsV1), { intake: 1500, protein: "", height: "", water: "" }, `${file}: recovered targets are preserved`);
  assert.equal(staleTargetsLocked.context.document.querySelector("#targetIntakeInput").value, "1500", `${file}: UI refreshed to recovered targets`);
  assert.match(staleTargetsLocked.context.document.querySelector("#targetMessage").textContent, /另一个窗口/, `${file}: blocked targets save explains the conflict`);
  assert.ok(!stgStorage.dailyDietRestoreJournalV1, `${file}: gate consumed the stale journal`);

  // 6) 恢复入口遗留日志防护：gate 先恢复 O，新恢复 N 在 targets 写入失败后回滚——终态必须是 O 而不是 P
  const rgLock = makeRestoreLockStub();
  const rgStorage = {
    dailyDietRecordsV1: JSON.stringify([{ date: "2026-08-01", intake: 2000, weight: "", protein: "", water: "" }]),
    dailyDietTargetsV1: JSON.stringify({ intake: 2500, protein: "", height: "", water: "" }),
    dailyDietThemeV1: "light",
    dailyDietRestoreJournalV1: JSON.stringify({
      schemaVersion: 1,
      records: originalRecordsJson,
      targets: JSON.stringify({ intake: 1500, protein: "", height: "", water: "" }),
      theme: "light"
    })
  };
  const restoreGate = app(file, clock, rgStorage, rgLock.context());
  restoreGate.api.loadRecords();
  restoreGate.api.loadTargets();
  rgStorage.__failAfterSet = { dailyDietTargetsV1: 1 }; // 恢复 O 的 targets 写入成功后，N 的 targets 写入失败
  assert.equal(await restoreGate.api.restoreFullBackup(backup), false, `${file}: gated restore N fails at targets write`);
  assert.deepEqual(JSON.parse(rgStorage.dailyDietRecordsV1), JSON.parse(originalRecordsJson), `${file}: gate recovered O before N and rollback returns to O`);
  assert.equal(JSON.parse(rgStorage.dailyDietTargetsV1).intake, 1500, `${file}: O targets preserved through failed restore N`);
  assert.ok(!rgStorage.dailyDietRestoreJournalV1, `${file}: clean rollback removes journal`);
  assert.ok(!rgFinalProbe(rgStorage), `${file}: no partial restored records remain`);

  // 7) seed 锁：种子导入走统一事务，不覆盖真实用户记录（仅 index.html 具备种子导入）
  const seedApiProbe = app(file, clock, {}).api;
  if (seedApiProbe.importInitialRecords) {
  const seedStorage = {};
  const seedChains = {};
  const makeSeedLockContext = () => ({
    navigator: {
      locks: {
        request(name, callback) {
          seedChains[name] = (seedChains[name] || Promise.resolve()).then(() => Promise.resolve().then(callback));
          return seedChains[name];
        }
      }
    }
  });
  const seedUser = app(file, clock, seedStorage, makeSeedLockContext());
  const seedDemo = app(file, clock, seedStorage, makeSeedLockContext());
  seedUser.api.loadRecords();
  seedDemo.api.loadRecords();
  assert.equal(
    await seedUser.api.applyRecordMutationAndSave(() => seedUser.api.recordsByDate.set("2026-07-21", { date: "2026-07-21", intake: 800, weight: "", protein: "", water: "" })),
    true,
    `${file}: user record saved before seed`
  );
  await seedDemo.api.importInitialRecords();
  const seedFinal = JSON.parse(seedStorage.dailyDietRecordsV1);
  assert.ok(seedFinal.some((r) => r.date === "2026-07-21" && r.intake === 800), `${file}: user record survives seed import under lock`);
  assert.ok(seedFinal.some((r) => r.date === "2026-02-12" && r.intake === 650), `${file}: seed fills only dates missing from latest state`);
  assert.equal(seedStorage.dailyDietSeed20260212To20260508, "done", `${file}: seed marker set after locked import`);
  }

  // 8) theme 事务：遗留日志存在时先恢复，再基于恢复后的主题切换并持久化
  const themeGateStorage = {
    dailyDietRecordsV1: JSON.stringify([]),
    dailyDietTargetsV1: JSON.stringify({ intake: 2500, protein: "", height: "", water: "" }),
    dailyDietThemeV1: "light",
    dailyDietRestoreJournalV1: JSON.stringify({
      schemaVersion: 1,
      records: JSON.stringify([]),
      targets: JSON.stringify({ intake: 1500, protein: "", height: "", water: "" }),
      theme: "dark"
    })
  };
  const themeGateTab = app(file, clock, themeGateStorage, makeRestoreLockStub().context());
  assert.equal(await themeGateTab.api.persistThemeToggle(), true, `${file}: theme toggle under lock succeeds after gated recovery`);
  assert.equal(themeGateTab.context.document.documentElement.getAttribute("data-theme"), "light", `${file}: recovery applied dark then toggle flipped to light`);
  assert.ok(!themeGateStorage.dailyDietRestoreJournalV1, `${file}: theme transaction consumes stale journal`);
  assert.equal(themeGateStorage.dailyDietThemeV1, "light", `${file}: toggled theme persisted`);




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

  // O(n) 滑动窗口实现必须与朴素参考实现逐点一致（含跨月/跨年与稀疏间隙）。
  const dayMs = 86400000;
  const toOrdinal = (dateString) => {
    const [year, month, day] = dateString.split("-").map(Number);
    return Math.round(Date.UTC(year, month - 1, day) / dayMs);
  };
  const fromOrdinal = (ordinal) => new Date(ordinal * dayMs).toISOString().slice(0, 10);
  const slidingDates = [];
  let cursor = toOrdinal("2025-11-20");
  for (let i = 0; i < 140; i += 1) {
    slidingDates.push(fromOrdinal(cursor));
    cursor += (i % 7 === 3) ? 3 : 1;
  }
  const slidingValues = slidingDates.map((date, index) => ({ index, date, value: 500 + ((index * 137) % 1900) }));
  for (const windowDays of [3, 7, 30]) {
    const sliding = instance.api.movingAverage(slidingValues, slidingValues, windowDays).map((x) => x.value);
    const naive = slidingValues.map((point) => {
      const startString = fromOrdinal(toOrdinal(point.date) - (windowDays - 1));
      const group = slidingValues.filter((item) => item.date >= startString && item.date <= point.date);
      return Math.round(group.reduce((sum, item) => sum + Number(item.value), 0) / group.length);
    });
    assert.deepEqual(sliding, naive, `${file}: sliding-window average matches naive reference (${windowDays}d)`);
  }
  // 部分值序列 + 完整序列（摄入图的真实调用形态）也要一致。
  const partialValues = slidingValues.filter((_, index) => index % 2 === 0);
  const partialSliding = instance.api.movingAverage(partialValues, slidingValues, 7).map((x) => x.value);
  const partialNaive = partialValues.map((point) => {
    const startString = fromOrdinal(toOrdinal(point.date) - 6);
    const group = slidingValues.filter((item) => item.date >= startString && item.date <= point.date);
    return Math.round(group.reduce((sum, item) => sum + Number(item.value), 0) / group.length);
  });
  assert.deepEqual(partialSliding, partialNaive, `${file}: sliding-window average matches naive reference (partial vs all)`);
}

console.log("NutriFlow reliability regression tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
