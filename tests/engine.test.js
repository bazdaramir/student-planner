/* ==========================================================================
   tests/engine.test.js

   Runs the real source files (no mocks of the engine itself) inside a Node VM
   and asserts the date converter, the calculation engine, the validators and
   the acceptance scenario from the specification.

   Usage:  node tests/engine.test.js
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "..", "src");

/* --------------------------------------------------------------- harness - */

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(name + (detail ? "  ->  " + detail : ""));
  }
}

function eq(name, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  ok(name, same, same ? "" : "got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected));
}

function close(name, actual, expected, tolerance) {
  const t = tolerance === undefined ? 0.05 : tolerance;
  const same = Math.abs(actual - expected) <= t;
  ok(name, same, same ? "" : "got " + actual + ", expected ~" + expected);
}

function section(title) {
  console.log("\n" + title);
  console.log("-".repeat(title.length));
}

/* ------------------------------------------------------------- sandbox --- */

const sandbox = {
  console: console,
  Date: Date,
  JSON: JSON,
  Math: Math,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Error: Error,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

/* Minimal localStorage so persistence and boot recovery are actually exercised
   rather than silently falling back to memory-only mode. */
sandbox.localStorage = (function () {
  const map = Object.create(null);
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => {
      map[k] = String(v);
    },
    removeItem: (k) => {
      delete map[k];
    },
    clear: () => {
      Object.keys(map).forEach((k) => delete map[k]);
    },
    get length() {
      return Object.keys(map).length;
    },
    key: (i) => Object.keys(map)[i] || null,
    __keys: () => Object.keys(map)
  };
})();

vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(SRC, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

load("js/core.js");
load("js/date.js");
load("js/store.js");
load("js/stats.js");

/* transfer.js touches HDML.ui/HDML.reports only at call time, but reads them
   at module scope - provide inert stubs so validateImport can be tested. */
sandbox.HDML.ui = {
  el: function () {},
  toast: function () {},
  notice: function () {},
  kv: function () {},
  button: function () {},
  confirm: function () {},
  openModal: function () {},
  closeModal: function () {},
  clear: function () {},
  empty: function () {}
};
sandbox.HDML.reports = { sanitizeFilename: (s) => s };
load("js/transfer.js");
load("js/week-import.js");
load("js/demo.js");

const H = sandbox.HDML;
const D = H.date;
const S = H.stats;
const A = H.actions;
const Q = H.query;
const util = H.util;

/* Latin digits keep the assertions readable. */
util.usePersianDigits = false;

/* ======================================================= 1. date engine = */

section("1. Jalali date engine");

const anchors = [
  ["1979-02-11", 1357, 11, 22, "انقلاب"],
  ["2000-01-01", 1378, 10, 11, "میلادی ۲۰۰۰"],
  ["2021-03-21", 1400, 1, 1, "نوروز ۱۴۰۰"],
  ["2022-03-21", 1401, 1, 1, "نوروز ۱۴۰۱"],
  ["2023-03-21", 1402, 1, 1, "نوروز ۱۴۰۲"],
  ["2024-03-20", 1403, 1, 1, "نوروز ۱۴۰۳"],
  ["2025-03-21", 1404, 1, 1, "نوروز ۱۴۰۴"],
  ["2026-03-21", 1405, 1, 1, "نوروز ۱۴۰۵"],
  ["2026-08-14", 1405, 5, 23, "۲۳ مرداد ۱۴۰۵"]
];

anchors.forEach(([iso, jy, jm, jd, label]) => {
  const j = D.jalaliOf(iso);
  eq("toJalali " + iso + " (" + label + ")", [j.jy, j.jm, j.jd], [jy, jm, jd]);
  const g = D.toGregorian(jy, jm, jd);
  const back =
    g.gy + "-" + String(g.gm).padStart(2, "0") + "-" + String(g.gd).padStart(2, "0");
  eq("toGregorian " + jy + "/" + jm + "/" + jd, back, iso);
});

/* Round-trip every day across four years, including two leap years. */
let roundTripFailures = 0;
let cursor = "2022-01-01";
for (let i = 0; i < 365 * 4; i++) {
  const j = D.jalaliOf(cursor);
  const g = D.toGregorian(j.jy, j.jm, j.jd);
  const back =
    g.gy + "-" + String(g.gm).padStart(2, "0") + "-" + String(g.gd).padStart(2, "0");
  if (back !== cursor) roundTripFailures++;
  cursor = D.addDays(cursor, 1);
}
ok("round-trip 1460 consecutive days", roundTripFailures === 0, roundTripFailures + " mismatches");

eq("1403 is a leap Jalali year", D.isJalaliLeap(1403), true);
eq("1404 is not a leap Jalali year", D.isJalaliLeap(1404), false);
eq("Esfand 1403 has 30 days", D.jalaliMonthLength(1403, 12), 30);
eq("Esfand 1404 has 29 days", D.jalaliMonthLength(1404, 12), 29);
eq("Farvardin has 31 days", D.jalaliMonthLength(1405, 1), 31);
eq("Mehr has 30 days", D.jalaliMonthLength(1405, 7), 30);

eq("invalid Jalali date rejected", D.isValidJalali(1404, 12, 30), false);
eq("valid Jalali date accepted", D.isValidJalali(1403, 12, 30), true);
eq("jalaliInputToISO parses Persian digits", D.jalaliInputToISO("۱۴۰۵/۰۵/۲۳"), "2026-08-14");
eq("jalaliInputToISO rejects nonsense", D.jalaliInputToISO("1405/13/40"), null);
eq("isValidISO rejects 2025-02-30", D.isValidISO("2025-02-30"), false);

/* Iranian week: Saturday = 0 */
eq("dowIndex of a Saturday", D.dowIndex("2026-08-15"), 0);
eq("dowIndex of a Friday", D.dowIndex("2026-08-14"), 6);
eq("weekStart of a Friday is the prior Saturday", D.weekStart("2026-08-14"), "2026-08-08");
eq("weekStart of a Saturday is itself", D.weekStart("2026-08-15"), "2026-08-15");
eq("weekDates yields 7 days", D.weekDates("2026-08-15").length, 7);
eq("diffDays across a month boundary", D.diffDays("2026-07-30", "2026-08-02"), 3);

/* ================================================= 2. helper arithmetic = */

section("2. Utility arithmetic");

eq("pct(0 of 0) is null, not 0", util.pct(0, 0), null);
eq("pct(9 of 11)", util.pct(9, 11), 81.8);
eq("safeDiv guards against divide-by-zero", util.safeDiv(5, 0, -1), -1);
eq("fmtHM(380)", util.fmtHM(380), "6:20");
eq("fmtDur(380)", util.fmtDur(380), "6 ساعت و 20 دقیقه");
eq("fmtDur(45)", util.fmtDur(45), "45 دقیقه");
eq("fmtDelta negative", util.fmtDelta(-40), "−0:40");
eq("enDigits converts Persian numerals", util.enDigits("۱۲۳۴"), "1234");

/* =============================================== 3. acceptance scenario = */

section("3. Acceptance scenario from the specification (§104)");

/* Build the exact plan from the spec on a fresh state. */
H.store.replace(H.defaultState(), { silent: true });
A.setProfile({ firstName: "آزمون", lastName: "پذیرش", track: "riazi" });

const mathId = A.addSubject("ریاضی");
const physicsId = A.addSubject("فیزیک");
const bioId = A.addSubject("زیست‌شناسی");
const chemId = A.addSubject("شیمی");

/* The scenario is deliberately dated ahead of today - it also covers the
   regression where a future-dated week already carries logged work. Derived
   from the clock rather than hard-coded so the suite never expires. */
const scenarioStart = D.weekStart(D.addDays(D.today(), 14));

const weekId = A.createWeek(scenarioStart, "هفته آزمون");
const saturday = Q.daysOfWeek(weekId)[0];
eq("createWeek produced 7 days", Q.daysOfWeek(weekId).length, 7);
eq("first day of the week is Saturday", saturday.dowIndex, 0);

const tRead = A.addTask(saturday.id, {
  subjectId: mathId,
  title: "خواندن مشتق",
  type: "study",
  plannedMinutes: 60
});
const tQuestions = A.addTask(saturday.id, {
  subjectId: mathId,
  title: "حل ۳۰ تست",
  type: "practice",
  plannedMinutes: 90,
  targetQuestions: 30
});
const tPhysics = A.addTask(saturday.id, {
  subjectId: physicsId,
  title: "مرور حرکت‌شناسی",
  type: "review",
  plannedMinutes: 45
});
const tBio = A.addTask(saturday.id, {
  subjectId: bioId,
  title: "فصل ۵ بخش ۲",
  type: "study",
  plannedMinutes: 75
});

eq("four tasks on Saturday", Q.tasksOfDay(saturday.id).length, 4);
eq("planned minutes total 270", S.dayStats(saturday.id).plannedMinutes, 270);

/* Student performs exactly as the spec describes. */
A.completeTask(tRead, { actualMinutes: 55 });
A.completeTask(tQuestions, {
  actualMinutes: 82,
  questions: { completed: 28, correct: 21, wrong: 7, unanswered: 0 }
});
A.completeTask(tPhysics, { actualMinutes: 40 });
/* Biology is left incomplete. */

const day = S.dayStats(saturday.id);

eq("Math actual = 137 minutes", subjectMinutes(day, mathId), 137);
eq("Physics actual = 40 minutes", subjectMinutes(day, physicsId), 40);
eq("Biology actual = 0 minutes", subjectMinutes(day, bioId), 0);
eq("daily total actual = 177 minutes", day.actualMinutes, 177);
eq("daily planned = 270 minutes", day.plannedMinutes, 270);
eq("tasks completed 3 of 4", [day.completedTasks, day.totalTasks], [3, 4]);
close("task completion rate 75%", day.taskCompletionRate, 75);
close("study achievement 65.6%", day.studyAchievementRate, 65.6, 0.1);
eq("questions completed 28 of 30", [day.completedQuestions, day.targetQuestions], [28, 30]);
close("question completion 93.3%", day.questionCompletionRate, 93.3, 0.1);
close("accuracy 75% (21 of 28 answered)", day.accuracy, 75);

const week = S.weekStats(weekId);
eq("weekly total rolls up the day", week.actualMinutes, 177);
eq("weekly planned rolls up the day", week.plannedMinutes, 270);
eq("weekly task counts roll up", [week.completedTasks, week.totalTasks], [3, 4]);

/* Regression: this week is dated ahead of "today", yet work has been logged
   on it. A report must never claim study time while reporting no elapsed day
   and no best/weakest day. */
eq("a worked-on day counts as elapsed even if future-dated", week.elapsedDays, 1);
eq("average daily minutes reflects the worked day", week.averageDailyMinutes, 177);
ok("a best day is identified", week.bestDay !== null);
eq("the best day is Saturday", week.bestDay.dayName, "شنبه");
eq("best-day minutes match the day total", week.bestDay.actualMinutes, 177);

const mathWeek = week.bySubject.filter((r) => r.subjectId === mathId)[0];
eq("weekly Math subject total = 137", mathWeek.actualMinutes, 137);
eq("weekly Math planned = 150", mathWeek.plannedMinutes, 150);
close("weekly Math achievement 91.3%", mathWeek.studyAchievementRate, 91.3, 0.1);

const radar = S.subjectRadar(weekId);
const mathRadar = radar.filter((r) => r.subjectId === mathId)[0];
close("radar reflects Math achievement", mathRadar.value, 91.3, 0.1);
ok(
  "radar excludes subjects with no planned and no actual time",
  !radar.some((r) => r.subjectId === chemId)
);

const trend = S.trend({ weekId: weekId });
eq("trend has one point per day", trend.length, 7);
eq("trend Saturday actual = 177", trend[0].actualMinutes, 177);
eq("future days are flagged as such", trend[0].isFuture, true);

/* Regression: the trend chart must not discard a future-dated day the student
   has already worked on, or it would claim "no history" while the summary
   right above it reports hours studied. */
const drawable = trend.filter((p) => !p.isFuture || p.actualMinutes > 0);
eq("a worked-on future day survives the chart filter", drawable.length, 1);
ok(
  "study time is present on the surviving point",
  drawable[0].actualMinutes === 177
);

function subjectMinutes(agg, subjectId) {
  const row = agg.bySubject.filter((r) => r.subjectId === subjectId)[0];
  return row ? row.actualMinutes : 0;
}

/* ---- exam half of the acceptance scenario ---- */

const examId = A.addExam({
  name: "آزمون آزمایشی ۴",
  date: D.addDays(scenarioStart, 4),
  subjectIds: [mathId, physicsId, chemId, bioId],
  scoreMode: "percentage"
});

A.setExamResult(examId, {
  taken: true,
  rank: 1254,
  subjectResults: [
    { subjectId: mathId, totalQuestions: 0, percentage: 72 },
    { subjectId: physicsId, totalQuestions: 0, percentage: 64 },
    { subjectId: chemId, totalQuestions: 0, percentage: 58 },
    { subjectId: bioId, totalQuestions: 0, percentage: 81 }
  ]
});

const exam = S.examStats(examId);
eq("exam records rank", exam.rank, 1254);
/* mean(72,64,58,81) = 68.75, rounded to one decimal for display = 68.8 */
close("exam overall = mean of 72/64/58/81", exam.overallPercentage, 68.8, 0.01);
eq("exam best subject is Biology", exam.best.subjectId, bioId);
eq("exam worst subject is Chemistry", exam.worst.subjectId, chemId);

const weekWithExam = S.weekStats(weekId);
eq("exam appears in its own week", weekWithExam.exams.length, 1);
eq("exam appears in the exam history", S.allExamStats().length, 1);

/* =============================================== 4. actual vs estimated = */

section("4. Actual time vs planned time");

const tEstimated = A.addTask(saturday.id, {
  subjectId: chemId,
  title: "بدون ثبت زمان",
  plannedMinutes: 90
});
A.completeTask(tEstimated, {}); /* completed, no time entered */

const estStats = S.taskStats(H.store.get().consultant.tasks[tEstimated]);
eq("fallback uses planned minutes", estStats.actualMinutes, 90);
eq("fallback is flagged as estimated", estStats.timeSource, "estimated");
eq("fallback is not counted as recorded", estStats.hasRecordedTime, false);

const withTime = S.taskStats(H.store.get().consultant.tasks[tRead]);
eq("recorded time is not the planned time", withTime.actualMinutes, 55);
eq("recorded time is flagged actual", withTime.timeSource, "actual");
ok("planned 60 was NOT used for a task that took 55", withTime.actualMinutes !== 60);

const dayWithEstimate = S.dayStats(saturday.id);
eq("estimated minutes tracked separately", dayWithEstimate.estimatedMinutes, 90);
eq("recorded minutes tracked separately", dayWithEstimate.recordedMinutes, 177);
eq("estimate flag surfaces on the aggregate", dayWithEstimate.hasEstimatedTime, true);

A.deleteTask(tEstimated);
eq("deleting a task removes its log too", A.getLog(tEstimated), null);
eq("day totals recover after deletion", S.dayStats(saturday.id).actualMinutes, 177);

/* ==================================================== 5. skip behaviour = */

section("5. Skipped tasks and reasons");

A.skipTask(tBio, "fatigue", "دیشب دیر خوابیدم");
const daySkipped = S.dayStats(saturday.id);
eq("skipped task counted", daySkipped.skippedTasks, 1);
eq("skipped task carries a reason", daySkipped.skipped[0].skipReason, "fatigue");
eq("skipped task contributes no study time", daySkipped.actualMinutes, 177);
eq("skip reasons are tallied", S.countSkipReasons(daySkipped.skipped)[0].count, 1);
eq(
  "skipped task still counts against the plan",
  daySkipped.plannedMinutes,
  270
);

A.resetTask(tBio);
eq("reset clears the skip", S.dayStats(saturday.id).skippedTasks, 0);

/* =========================================================== 6. timers = */

section("6. Timers");

A.startTimer(tBio);
ok("a timer is running", A.runningTaskId() === tBio);
A.startTimer(tPhysics);
eq("starting a second timer stops the first", A.runningTaskId(), tPhysics);
ok(
  "only one timer runs at a time",
  Object.keys(H.store.get().student.timers).filter(
    (id) => H.store.get().student.timers[id].running
  ).length === 1
);
A.stopTimer(tPhysics);
eq("no timer runs after stop", A.runningTaskId(), null);
ok(
  "a sub-5-second session is discarded as an accidental tap",
  A.sumSessions(H.store.get().student.timers[tPhysics]) === 0
);

/* Regression: a short but deliberate session must never be credited as 0
   minutes, which would make a completed task look like no study happened. */
eq("zero elapsed credits nothing", A.timerMinutesToCredit(0), 0);
eq("12 seconds credits one minute, not zero", A.timerMinutesToCredit(0.2), 1);
eq("40 seconds credits one minute", A.timerMinutesToCredit(0.67), 1);
eq("90 seconds credits two minutes", A.timerMinutesToCredit(1.5), 2);
eq("52.4 minutes credits 52", A.timerMinutesToCredit(52.4), 52);

const shortTask = A.addTask(saturday.id, {
  subjectId: chemId,
  title: "جلسه‌ی کوتاه",
  plannedMinutes: 40
});
H.store.mutate(function (st) {
  st.student.timers[shortTask] = {
    sessions: [{ id: "s1", startedAt: D.now(), endedAt: D.now(), duration: 0.2 }],
    running: null
  };
});
A.stopTimer(shortTask);
eq(
  "a 12-second timed session records 1 minute, not 0",
  A.getLog(shortTask).actualMinutes,
  1
);
A.completeTask(shortTask, {});
eq(
  "completing with only a tiny timer keeps the measured minute",
  S.taskStats(H.store.get().consultant.tasks[shortTask]).actualMinutes,
  1
);
eq(
  "and it is reported as measured, not estimated",
  S.taskStats(H.store.get().consultant.tasks[shortTask]).timeSource,
  "timer"
);
A.deleteTask(shortTask);
eq(
  "completed task keeps its recorded time after a stray timer",
  S.taskStats(H.store.get().consultant.tasks[tPhysics]).actualMinutes,
  40
);

/* ======================================================= 7. validation = */

section("7. Validation");

eq(
  "negative duration rejected",
  A.validateCompletion({ actualMinutes: -5 }).length > 0,
  true
);
eq(
  "duration above 24h rejected",
  A.validateCompletion({ actualMinutes: 2000 }).length > 0,
  true
);
eq(
  "correct+wrong+unanswered may not exceed completed",
  A.validateCompletion({
    actualMinutes: 30,
    questions: { completed: 10, correct: 8, wrong: 5, unanswered: 0 }
  }).length > 0,
  true
);
eq(
  "consistent question counts accepted",
  A.validateCompletion({
    actualMinutes: 30,
    questions: { completed: 10, correct: 7, wrong: 2, unanswered: 1 }
  }).length,
  0
);
eq(
  "empty duration accepted (falls back to planned)",
  A.validateCompletion({ actualMinutes: null }).length,
  0
);

/* ================================================= 8. Konkur percentage = */

section("8. Exam percentage rules");

close("all correct = 100%", S.konkurPercentage(10, 0, 10), 100);
close("all wrong = -33.3%", S.konkurPercentage(0, 10, 10), -33.3, 0.1);
close("all blank = 0%", S.konkurPercentage(0, 0, 10), 0);
close("7 right 3 wrong of 10 = 60%", S.konkurPercentage(7, 3, 10), 60);
eq("no questions returns null, not 0", S.konkurPercentage(0, 0, 0), null);
close(
  "score20 mode converts to percentage",
  S.subjectResultPercentage({ score: 15 }, "score20"),
  75
);

/* ==================================================== 9. edge conditions = */

section("9. Edge cases");

const emptyWeekId = A.createWeek("2026-09-05", "هفته خالی");
const emptyWeek = S.weekStats(emptyWeekId);
eq("empty week has zero tasks", emptyWeek.totalTasks, 0);
eq("empty week completion rate is null, not 0%", emptyWeek.taskCompletionRate, null);
eq("empty week achievement is null", emptyWeek.studyAchievementRate, null);
eq("empty week overall score is null", emptyWeek.overallScore, null);
eq("empty week has no best day", emptyWeek.bestDay, null);
eq("empty week average is 0", emptyWeek.averageDailyMinutes, 0);
ok("trend for an empty week is not drawable", !S.hasTrendData(S.trend({ weekId: emptyWeekId })));

const zeroDay = Q.daysOfWeek(emptyWeekId)[0];
const zeroTask = A.addTask(zeroDay.id, {
  subjectId: mathId,
  title: "بدون زمان",
  plannedMinutes: 0
});
const zeroStats = S.taskStats(H.store.get().consultant.tasks[zeroTask]);
eq("zero planned minutes yields null achievement, not Infinity", zeroStats.studyAchievementRate, null);
A.completeTask(zeroTask, { actualMinutes: 20 });
close(
  "actual time still counts when planned was zero",
  S.dayStats(zeroDay.id).actualMinutes,
  20
);

const longTitle = "ا".repeat(400);
const longTask = A.addTask(zeroDay.id, { subjectId: mathId, title: longTitle, plannedMinutes: 30 });
eq("very long titles are stored intact", H.store.get().consultant.tasks[longTask].title.length, 400);
eq("truncate shortens for display", util.truncate(longTitle, 20).length, 20);

/* Many tasks: the engine must stay correct and fast. */
const perfWeek = A.createWeek("2026-10-03", "هفته حجیم");
const perfDays = Q.daysOfWeek(perfWeek);
const t0 = Date.now();
for (let i = 0; i < 350; i++) {
  A.addTask(perfDays[i % 7].id, {
    subjectId: i % 2 ? mathId : physicsId,
    title: "فعالیت " + i,
    plannedMinutes: 30,
    targetQuestions: 10
  });
}
const buildMs = Date.now() - t0;
const t1 = Date.now();
const perfStats = S.weekStats(perfWeek);
const statsMs = Date.now() - t1;
eq("350 tasks all registered", perfStats.totalTasks, 350);
eq("350 tasks planned minutes", perfStats.plannedMinutes, 10500);
ok("weekly stats for 350 tasks under 250ms", statsMs < 250, statsMs + "ms");
const t2 = Date.now();
S.weekStats(perfWeek);
ok("memoised second call is under 5ms", Date.now() - t2 < 5);

/* ================================================= 10. week duplication = */

section("10. Week duplication and moves");

const dupStart = D.addDays(scenarioStart, 7);
const dupId = A.duplicateWeek(weekId, dupStart);
const dup = S.weekStats(dupId);
const original = S.weekStats(weekId);
eq("duplicate copies every task", dup.totalTasks, original.totalTasks);
eq("duplicate copies planned minutes", dup.plannedMinutes, original.plannedMinutes);
eq("duplicate carries NO performance data", dup.actualMinutes, 0);
eq("duplicate starts on the requested Saturday", H.store.get().consultant.weeks[dupId].startDate, dupStart);
ok(
  "duplicate uses fresh task ids",
  Q.tasksOfWeek(dupId).every((t) => !Q.tasksOfWeek(weekId).some((o) => o.id === t.id))
);

const dupDays = Q.daysOfWeek(dupId);
const movingTask = Q.tasksOfDay(dupDays[0].id)[0];
A.moveTaskToDay(movingTask.id, dupDays[2].id);
eq(
  "moved task left its old day",
  Q.tasksOfDay(dupDays[0].id).some((t) => t.id === movingTask.id),
  false
);
eq(
  "moved task arrived on the new day",
  Q.tasksOfDay(dupDays[2].id).some((t) => t.id === movingTask.id),
  true
);

/* dupDays[0] still holds 3 tasks after the move above - enough to reorder. */
const before = Q.tasksOfDay(dupDays[0].id).map((t) => t.id);
ok("reorder fixture has at least 3 tasks", before.length >= 3, "has " + before.length);
const last = before[before.length - 1];
const secondLast = before[before.length - 2];
A.moveTask(last, -1);
const after = Q.tasksOfDay(dupDays[0].id).map((t) => t.id);
eq("moveTask moved the last task up one slot", after[after.length - 2], last);
eq("moveTask pushed its neighbour down", after[after.length - 1], secondLast);
eq("moveTask preserves the task count", after.length, before.length);
A.moveTask(last, 1);
eq("moveTask down restores the original order", Q.tasksOfDay(dupDays[0].id).map((t) => t.id), before);
A.moveTask(before[0], -1);
eq("moveTask at the top edge is a no-op", Q.tasksOfDay(dupDays[0].id).map((t) => t.id), before);

/* Deleting a week must not damage the others. */
const beforeDelete = S.weekStats(weekId).totalTasks;
A.deleteWeek(dupId);
eq("deleting a week leaves the original intact", S.weekStats(weekId).totalTasks, beforeDelete);
eq("deleted week is gone", H.store.get().consultant.weeks[dupId], undefined);

/* ================================================ 11. import validation = */

section("11. Import safety");

const TR = H.transfer;

eq("garbage input rejected", TR.validateImport("not an object").ok, false);
eq("unknown shape rejected", TR.validateImport({ hello: "world" }).ok, false);

const goodActivity = {
  kind: "hdml-activity",
  studentId: H.store.get().consultant.student.id,
  studentName: "آزمون پذیرش",
  student: { taskLogs: {}, timers: {}, dailyNotes: {}, weeklyReflections: {}, examResults: {} }
};
goodActivity.student.taskLogs[tRead] = {
  taskId: tRead,
  status: "completed",
  actualMinutes: 61,
  timeSource: "actual"
};
const okResult = TR.validateImport(goodActivity);
eq("valid activity file accepted", okResult.ok, true);
eq("activity kind detected", okResult.kind, "activity");
eq("matched log counted", okResult.info.matched, 1);

const badActivity = JSON.parse(JSON.stringify(goodActivity));
badActivity.student.taskLogs[tRead].actualMinutes = -30;
const badResult = TR.validateImport(badActivity);
eq("negative minutes rejected on import", badResult.ok, false);
ok("rejection carries a Persian message", /نامعتبر/.test(badResult.errors[0]));

const stateBefore = JSON.stringify(H.store.get().student);
TR.validateImport(badActivity);
eq("a failed validation changes nothing", JSON.stringify(H.store.get().student), stateBefore);

const foreignActivity = JSON.parse(JSON.stringify(goodActivity));
foreignActivity.studentId = "someone-else";
foreignActivity.student.taskLogs = { unknown_task_id: { status: "completed", actualMinutes: 10 } };
const foreignResult = TR.validateImport(foreignActivity);
eq("mismatched student still validates but warns", foreignResult.ok, true);
ok("warns about a different student", foreignResult.warnings.length >= 2);
eq("unmatched logs counted", foreignResult.info.unmatched, 1);

const backup = { kind: "hdml-backup", state: H.store.get() };
eq("valid backup accepted", TR.validateImport(backup).ok, true);
eq("truncated backup rejected", TR.validateImport({ kind: "hdml-backup", state: {} }).ok, false);

/* Payload embedding must survive a </script> inside the data. */
const tricky = { note: "</script><script>alert(1)</script>" };
ok(
  "embedded JSON escapes closing script tags",
  TR.safeJson(tricky).indexOf("</script>") === -1
);
const embedded = TR.embedPayload(
  '<html><script id="hdml-data" type="application/json">null<\/script></html>',
  tricky
);
ok("embedPayload rewrites the payload", embedded.indexOf("\\u003c/script") >= 0);
eq(
  "embedPayload returns null when the tag is missing",
  TR.embedPayload("<html></html>", tricky),
  null
);

/* ================================================= 12. normalize / boot = */

section("12. State normalisation");

const partial = H.store.normalize({ consultant: { student: { firstName: "نیمه" } } });
eq("normalize fills missing trees", typeof partial.student.taskLogs, "object");
eq("normalize keeps supplied fields", partial.consultant.student.firstName, "نیمه");
ok("normalize assigns a student id", !!partial.consultant.student.id);
eq("normalize survives null input", typeof H.store.normalize(null), "object");
eq(
  "normalize drops a currentWeekId that no longer exists",
  H.store.normalize({ ui: { currentWeekId: "ghost" } }).ui.currentWeekId,
  null
);

/* ========================================================= 13. the demo = */

section("13. Demo dataset");

H.demo.load();
const demoState = H.store.get();
eq("demo is flagged as demo data", demoState.meta.isDemo, true);
eq("demo has two weeks", Object.keys(demoState.consultant.weeks).length, 2);
ok("demo has many tasks", Object.keys(demoState.consultant.tasks).length > 40);
ok("demo has recorded activity", S.hasAnyActivity(demoState));
eq("demo has three exams", Object.keys(demoState.consultant.exams).length, 3);
eq("demo has two exam results", Object.keys(demoState.student.examResults).length, 2);

const demoWeek = S.weekStats(demoState.ui.currentWeekId);
ok("demo current week has study time", demoWeek.actualMinutes > 0);
ok("demo subject breakdown is populated", demoWeek.bySubject.length >= 3);
ok("demo trend is drawable", S.hasTrendData(S.trend({ limit: 28 })));

const demoExams = S.examTrend();
eq("demo exam trend has two points", demoExams.length, 2);
ok(
  "demo exam percentages land near their targets",
  Math.abs(demoExams[1].value - 58) < 12,
  "got " + demoExams[1].value
);
ok("demo exam trend is improving", demoExams[1].value > demoExams[0].value);

/* No task may report study time it did not earn. */
let inconsistent = 0;
Object.keys(demoState.consultant.tasks).forEach((id) => {
  const ts = S.taskStats(demoState.consultant.tasks[id], demoState);
  if (ts.isPending && ts.actualMinutes > 0) inconsistent++;
  if (ts.isSkipped && ts.actualMinutes > 0) inconsistent++;
  if (ts.questionsCompleted > 0 && ts.correct + ts.wrong + ts.unanswered > ts.questionsCompleted)
    inconsistent++;
});
eq("demo data is internally consistent", inconsistent, 0);

/* Aggregates must equal the sum of their parts - the "one source of truth"
   rule stated in the specification. */
const sumOfDays = demoWeek.days.reduce((a, d) => a + d.actualMinutes, 0);
eq("week total equals the sum of its days", demoWeek.actualMinutes, sumOfDays);
const sumOfSubjects = demoWeek.bySubject.reduce((a, r) => a + r.actualMinutes, 0);
eq("week total equals the sum of its subjects", demoWeek.actualMinutes, sumOfSubjects);
const sumOfTasks = demoWeek.taskStats.reduce((a, t) => a + t.actualMinutes, 0);
eq("week total equals the sum of its tasks", demoWeek.actualMinutes, sumOfTasks);

/* ============================================ 14. persistence & recovery = */

section("14. Persistence and boot recovery");

ok("localStorage is detected", H.store.isStorageAvailable());

/* --- regression: a plan authored from scratch must survive a reload ------
   The file itself carries no embedded payload, so boot cannot derive the
   storage key from it; it must fall back to the last student saved here. */
sandbox.localStorage.clear();
H.store.replace(H.defaultState(), { silent: true });
A.setProfile({ firstName: "بازیابی", lastName: "آزمون" });
const authoredId = H.store.get().consultant.student.id;
const authoredWeek = A.createWeek("2026-08-15", "هفته بازیابی");
A.addSubject("درس آزمون");
A.addTask(Q.daysOfWeek(authoredWeek)[0].id, {
  subjectId: H.store.get().consultant.subjects[0].id,
  title: "فعالیت ماندگار",
  plannedMinutes: 45
});
ok("state written to storage", H.store.persistNow());
ok(
  "a pointer to the last student is stored",
  sandbox.localStorage.getItem("hdml:v1:__last") === authoredId
);

/* Simulate a page refresh of a file with NO embedded plan. */
const reboot = H.store.boot(null);
eq("reload recovers from storage", reboot.source, "storage");
eq("reload keeps the same student", H.store.get().consultant.student.id, authoredId);
eq("reload keeps the student's name", Q.studentFullName(), "بازیابی آزمون");
eq("reload keeps the authored week", Object.keys(H.store.get().consultant.weeks).length, 1);
eq("reload keeps the authored task", Object.keys(H.store.get().consultant.tasks).length, 1);
eq(
  "reload keeps the task's planned minutes",
  S.weekStats(Object.keys(H.store.get().consultant.weeks)[0]).plannedMinutes,
  45
);

/* --- a file that DOES carry a plan uses its own bucket, not the pointer --- */
const foreignPlan = H.store.normalize({
  consultant: {
    student: { id: "stu_from_file", firstName: "فایل", lastName: "دیگر" },
    weeks: {},
    days: {},
    tasks: {},
    exams: {},
    subjects: []
  },
  meta: { planStamp: "2026-01-01T00:00:00.000Z" }
});
const bootFromFile = H.store.boot(foreignPlan);
eq("an embedded plan wins over the local pointer", bootFromFile.source, "file");
eq("embedded student id is used", H.store.get().consultant.student.id, "stu_from_file");
ok(
  "the other student's data is untouched in storage",
  !!sandbox.localStorage.getItem("hdml:v1:" + authoredId)
);

/* --- a newer plan in the file is offered, never silently applied --------- */
H.store.boot(null); /* back to the authored student */
H.store.persistNow();
const newerPlan = H.store.normalize(JSON.parse(JSON.stringify(H.store.get())));
newerPlan.meta.planStamp = "2099-01-01T00:00:00.000Z";
newerPlan.consultant.tasks = {};
const bootNewer = H.store.boot(newerPlan);
eq("a newer plan in the file is detected", bootNewer.newerPlanInFile, true);
eq("local data is still what loaded", bootNewer.source, "storage");
eq(
  "the newer plan is NOT applied without consent",
  Object.keys(H.store.get().consultant.tasks).length,
  1
);

/* Adopting it keeps student performance and replaces only the plan. */
const keptTaskId = Object.keys(H.store.get().consultant.tasks)[0];
A.completeTask(keptTaskId, { actualMinutes: 33 });
H.store.adoptPlan(H.store.pendingPlan);
eq("adopting applies the new plan", Object.keys(H.store.get().consultant.tasks).length, 0);
eq(
  "adopting preserves the student's recorded performance",
  H.store.get().student.taskLogs[keptTaskId].actualMinutes,
  33
);

/* --- reset clears both the bucket and the pointer ----------------------- */
H.store.clearStored();
eq("reset removes the pointer", sandbox.localStorage.getItem("hdml:v1:__last"), null);
const afterReset = H.store.boot(null);
eq("after a reset the app starts empty", afterReset.source, "new");
eq("after a reset there are no weeks", Object.keys(H.store.get().consultant.weeks).length, 0);

/* --- storage failures must not take the app down ------------------------ */
const realSetItem = sandbox.localStorage.setItem;
sandbox.localStorage.setItem = function () {
  throw new Error("QuotaExceededError");
};
eq("persistNow reports failure instead of throwing", H.store.persistNow(), false);
sandbox.localStorage.setItem = realSetItem;
ok("the app still works after a storage failure", !!Q.studentFullName());

/* =========================================== 15. weekly JSON plan import = */

section("15. Weekly plan import (the consultant's JSON hand-off)");

const WI = H.weekImport;

/* --- the shipped example file must actually work ------------------------ */
const examplePath = path.join(__dirname, "..", "examples", "ENIGMA-Week-03.json");
ok("the example plan file exists", fs.existsSync(examplePath));
const exampleRaw = JSON.parse(fs.readFileSync(examplePath, "utf8"));
const example = WI.parse(exampleRaw);
eq("the example plan parses", example.ok, true);
eq("the example plan has no warnings", example.warnings, []);
eq("the example plan covers seven days", example.plan.days.length, 7);
eq("the example week is titled", example.plan.title, "هفته ۳");
eq("the example start date snaps to a Saturday", D.dowIndex(example.plan.startDate), 0);
ok("the example plan has a realistic task count", example.plan.summary.tasks >= 15);
ok("the example plan has realistic hours", example.plan.summary.minutes > 600);

/* --- importing it builds a real week ------------------------------------ */
H.store.replace(H.defaultState(), { silent: true });
const importedWeekId = A.createWeekFromPlan(example.plan);
const importedWeek = S.weekStats(importedWeekId);
eq("import creates every task", importedWeek.totalTasks, example.plan.summary.tasks);
eq("import preserves total planned minutes", importedWeek.plannedMinutes, example.plan.summary.minutes);
eq("import creates the subjects it needs", H.store.get().consultant.subjects.length, example.plan.summary.subjects.length);
eq("import carries no performance data", importedWeek.actualMinutes, 0);
eq("import sets the student name", Q.studentFullName(), "امیر رضایی");
eq("import sets the consultant name", H.store.get().consultant.student.consultantName, "آقای احمدی");
ok("import carries the week note", !!H.store.get().consultant.weeks[importedWeekId].consultantNote);

const satTasks = Q.tasksOfDay(Q.daysOfWeek(importedWeekId)[0].id);
eq("Saturday got its four tasks", satTasks.length, 4);
eq("Persian task type «تست» maps to practice", satTasks[1].type, "practice");
eq("Persian task type «درس» maps to study", satTasks[0].type, "study");
eq("question targets survive", satTasks[1].targetQuestions, 30);
eq("consultant notes on a task survive", satTasks[0].consultantNote.length > 0, true);
eq("day order is preserved", satTasks[0].title, "خواندن درسنامه‌ی مشتق");

/* Importing a second week must not disturb the first. */
const second = WI.parse(
  Object.assign({}, exampleRaw, {
    week: { title: "هفته ۴", startDate: "۱۴۰۵/۰۶/۱۴" }
  })
);
eq("a second plan parses", second.ok, true);
const secondWeekId = A.createWeekFromPlan(second.plan);
eq("both weeks now exist", Object.keys(H.store.get().consultant.weeks).length, 2);
eq("the first week is untouched", S.weekStats(importedWeekId).totalTasks, example.plan.summary.tasks);
eq(
  "subjects are reused, not duplicated",
  H.store.get().consultant.subjects.length,
  example.plan.summary.subjects.length
);
ok(
  "the two weeks do not overlap in time",
  H.store.get().consultant.weeks[secondWeekId].startDate >
    H.store.get().consultant.weeks[importedWeekId].endDate
);

/* --- rejection paths ---------------------------------------------------- */
eq("a non-object is rejected", WI.parse("nope").ok, false);
eq("a plan with no days is rejected", WI.parse({ week: { startDate: "۱۴۰۵/۰۶/۰۷" } }).ok, false);
eq(
  "a bad date is rejected",
  WI.parse({ week: { startDate: "چهارشنبه" }, days: [{ day: "شنبه", tasks: [] }] }).ok,
  false
);
eq(
  "a plan with zero tasks is rejected",
  WI.parse({ week: { startDate: "۱۴۰۵/۰۶/۰۷" }, days: [{ day: "شنبه", tasks: [] }] }).ok,
  false
);
const activityAsPlan = WI.parse({ kind: "hdml-activity", student: {} });
eq("an activity file is not mistaken for a plan", activityAsPlan.ok, false);
ok("and it says so plainly", /فایل عملکرد|پشتیبان/.test(activityAsPlan.errors[0]));

/* --- forgiving where it should be --------------------------------------- */
const messy = WI.parse({
  week: { startDate: "2026-08-29", title: "" },
  days: [
    { day: "چهار‌شنبه", tasks: [{ subject: "ریاضی", title: "تست", minutes: 30 }] },
    { day: "روز نامعلوم", tasks: [{ subject: "x", title: "y", minutes: 10 }] },
    { day: "شنبه", tasks: [{ subject: "زیست", minutes: 20 }] }
  ]
});
eq("a Gregorian start date is accepted", messy.ok, true);
eq("start date snaps to Saturday", D.dowIndex(messy.plan.startDate), 0);
eq("a missing title falls back", messy.plan.title, "هفته‌ی جدید");
/* Wednesday and Saturday survive; "روز نامعلوم" is dropped. Saturday is kept
   even though its only task was unusable - a day may still carry a note. */
eq("an unknown day name is dropped", messy.plan.days.length, 2);
eq(
  "the recognised days are Wednesday and Saturday",
  messy.plan.days.map((d) => d.dowIndex).sort(),
  [0, 4]
);
eq(
  "the day whose task was unusable ends up empty",
  messy.plan.days.filter((d) => d.dowIndex === 0)[0].tasks.length,
  0
);
ok(
  "warnings explain what was skipped",
  messy.warnings.length >= 2,
  JSON.stringify(messy.warnings)
);
eq("a task with no title is skipped", messy.plan.summary.tasks, 1);

const negative = WI.parse({
  week: { startDate: "۱۴۰۵/۰۶/۰۷" },
  days: [{ day: "شنبه", tasks: [{ subject: "ریاضی", title: "تست", minutes: -50, questions: -3 }] }]
});
eq("negative minutes are clamped to zero", negative.plan.days[0].tasks[0].plannedMinutes, 0);
eq("negative question counts are clamped", negative.plan.days[0].tasks[0].targetQuestions, 0);
ok("and the student is warned", negative.warnings.length >= 1);

/* --- exam تراز round-trips ---------------------------------------------- */
const tarazExam = A.addExam({
  name: "قلم‌چی",
  date: "2026-09-04",
  subjectIds: [H.store.get().consultant.subjects[0].id]
});
A.setExamResult(tarazExam, {
  taken: true,
  taraz: 6180,
  rank: 940,
  subjectResults: [{ subjectId: H.store.get().consultant.subjects[0].id, percentage: 70 }]
});
eq("تراز is stored and read back", S.examStats(tarazExam).taraz, 6180);
eq("rank is stored and read back", S.examStats(tarazExam).rank, 940);
close("percentage still computes", S.examStats(tarazExam).overallPercentage, 70);

/* ------------------------------------------------------------- summary -- */

console.log("\n" + "=".repeat(56));
if (failed === 0) {
  console.log("ALL TESTS PASSED  (" + passed + " assertions)");
} else {
  console.log(failed + " FAILED, " + passed + " passed");
  failures.forEach((f) => console.log("  FAIL: " + f));
}
console.log("=".repeat(56));
process.exit(failed === 0 ? 0 : 1);
