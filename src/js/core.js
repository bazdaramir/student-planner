(function (global) {
  "use strict";

  var HDML = (global.HDML = global.HDML || {});

  HDML.VERSION = "1.0.0";
  HDML.SCHEMA_VERSION = 1;

  HDML.TASK_TYPES = [
    { id: "study", label: "درس / مطالعه", questions: false },
    { id: "practice", label: "تست", questions: true },
    { id: "test", label: "آزمونک", questions: true },
    { id: "review", label: "دوره", questions: false },
    { id: "summary", label: "جمع‌بندی و خلاصه‌نویسی", questions: false },
    { id: "exam_analysis", label: "تحلیل آزمون", questions: false },
    { id: "other", label: "سایر", questions: true }
  ];

  HDML.TASK_STATUS = {
    PENDING: "pending",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    SKIPPED: "skipped"
  };

  HDML.STATUS_LABELS = {
    pending: "انجام‌نشده",
    in_progress: "در حال انجام",
    completed: "انجام‌شده",
    skipped: "انجام‌نشد"
  };

  HDML.PRIORITIES = [
    { id: "high", label: "زیاد" },
    { id: "normal", label: "متوسط" },
    { id: "low", label: "کم" }
  ];

  /* Reasons a task was not done. Lets the consultant tell "student did not
     work" apart from "the plan was unrealistic". */
  HDML.SKIP_REASONS = [
    { id: "no_time", label: "کمبود وقت" },
    { id: "fatigue", label: "خستگی" },
    { id: "overload", label: "حجم زیاد برنامه" },
    { id: "difficulty", label: "سختی درک مطلب" },
    { id: "unexpected", label: "اتفاق پیش‌بینی‌نشده" },
    { id: "focus", label: "تمرکز پایین" },
    { id: "other", label: "سایر" }
  ];

  HDML.TRACKS = [
    { id: "riazi", label: "ریاضی و فیزیک" },
    { id: "tajrobi", label: "علوم تجربی" },
    { id: "ensani", label: "علوم انسانی" },
    { id: "honar", label: "هنر" },
    { id: "zaban", label: "زبان‌های خارجی" },
    { id: "other", label: "سایر" }
  ];

  HDML.GRADES = ["دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل"];

  HDML.EXAM_TYPES = [
    { id: "mock", label: "آزمون آزمایشی" },
    { id: "school", label: "امتحان مدرسه" },
    { id: "class", label: "آزمون کلاسی" },
    { id: "self", label: "آزمون شخصی" },
    { id: "other", label: "سایر" }
  ];

  HDML.SUBJECT_COLORS = [
    "#2368e7",
    "#7b3fd4",
    "#0f9e8e",
    "#d4682a",
    "#c0392b",
    "#2e7d32",
    "#a98a24",
    "#4a6fa5",
    "#b5347a",
    "#5c6bc0"
  ];

  /* Default subject sets per track. The consultant can add/edit/remove
     subjects freely - this is only a starting point. */
  HDML.DEFAULT_SUBJECTS = {
    riazi: [
      "حسابان",
      "هندسه",
      "گسسته",
      "فیزیک",
      "شیمی",
      "ادبیات",
      "عربی",
      "دینی",
      "زبان انگلیسی"
    ],
    tajrobi: [
      "ریاضی",
      "زیست‌شناسی",
      "فیزیک",
      "شیمی",
      "زمین‌شناسی",
      "ادبیات",
      "عربی",
      "دینی",
      "زبان انگلیسی"
    ],
    ensani: [
      "ریاضی و آمار",
      "اقتصاد",
      "علوم و فنون",
      "عربی تخصصی",
      "تاریخ",
      "جغرافیا",
      "جامعه‌شناسی",
      "فلسفه و منطق",
      "روان‌شناسی",
      "ادبیات",
      "دینی",
      "زبان انگلیسی"
    ],
    honar: ["خلاقیت تصویری", "خلاقیت نمایشی", "ترسیم فنی", "درک عمومی هنر", "ادبیات", "دینی", "زبان انگلیسی"],
    zaban: ["زبان تخصصی", "ادبیات", "عربی", "دینی", "زبان انگلیسی"],
    other: ["ادبیات", "عربی", "دینی", "زبان انگلیسی", "ریاضی"]
  };

  var util = (HDML.util = {});

  var idCounter = 0;

  /** Collision-resistant id that stays readable in exported JSON. */
  util.uid = function (prefix) {
    idCounter += 1;
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      "_" +
      idCounter.toString(36) +
      Math.random().toString(36).slice(2, 6)
    );
  };

  util.clamp = function (n, min, max) {
    return Math.min(max, Math.max(min, n));
  };

  /** Division that returns `fallback` instead of NaN/Infinity. */
  util.safeDiv = function (a, b, fallback) {
    if (!b || !isFinite(b)) return fallback === undefined ? 0 : fallback;
    var r = a / b;
    return isFinite(r) ? r : fallback === undefined ? 0 : fallback;
  };

  /** Ratio -> whole-number percentage, clamped to a sane display range. */
  util.pct = function (a, b) {
    if (!b) return null; // null means "not applicable", never 0%
    return Math.round((a / b) * 1000) / 10;
  };

  util.round = function (n, digits) {
    var f = Math.pow(10, digits || 0);
    return Math.round(n * f) / f;
  };

  util.toInt = function (v, fallback) {
    var n = parseInt(String(v == null ? "" : v).replace(/[^\d-]/g, ""), 10);
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  };

  util.isFiniteNumber = function (v) {
    return typeof v === "number" && isFinite(v);
  };

  var FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  /** Latin digits -> Persian digits. Honoured by the `persianDigits` setting. */
  util.faDigits = function (input) {
    return String(input).replace(/[0-9]/g, function (d) {
      return FA_DIGITS[+d];
    });
  };

  util.enDigits = function (input) {
    return String(input)
      .replace(/[۰-۹]/g, function (d) {
        return String(d.charCodeAt(0) - 0x06f0);
      })
      .replace(/[٠-٩]/g, function (d) {
        return String(d.charCodeAt(0) - 0x0660);
      });
  };

  /* Number display honours the user's digit preference. Set by settings. */
  util.usePersianDigits = true;

  util.n = function (value) {
    var s = String(value);
    return util.usePersianDigits ? util.faDigits(s) : s;
  };

  /** "۶ ساعت و ۲۰ دقیقه" - used for headline figures. */
  util.fmtDur = function (minutes) {
    var m = Math.max(0, Math.round(minutes || 0));
    var h = Math.floor(m / 60);
    var rem = m % 60;
    if (h === 0) return util.n(rem) + " دقیقه";
    if (rem === 0) return util.n(h) + " ساعت";
    return util.n(h) + " ساعت و " + util.n(rem) + " دقیقه";
  };

  /** "۶:۲۰" - compact, for table cells and chart axes. */
  util.fmtHM = function (minutes) {
    var m = Math.max(0, Math.round(minutes || 0));
    var h = Math.floor(m / 60);
    var rem = m % 60;
    return util.n(h) + ":" + util.n(rem < 10 ? "0" + rem : String(rem));
  };

  /** Signed duration for planned-vs-actual differences. */
  util.fmtDelta = function (minutes) {
    var m = Math.round(minutes || 0);
    if (m === 0) return "۰";
    var sign = m > 0 ? "+" : "−";
    return sign + util.fmtHM(Math.abs(m));
  };

  util.fmtPct = function (value, digits) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    var d = digits === undefined ? 0 : digits;
    return util.n(util.round(value, d)) + "٪";
  };

  util.fmtHours = function (minutes) {
    return util.n(util.round((minutes || 0) / 60, 1));
  };

  util.escapeHtml = function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  util.clone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  util.isObject = function (v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  };

  /** Ordered values of an id-keyed map, sorted by `order` then insertion. */
  util.values = function (map) {
    if (!map) return [];
    return Object.keys(map).map(function (k) {
      return map[k];
    });
  };

  util.sortByOrder = function (list) {
    return list.slice().sort(function (a, b) {
      var ao = a.order == null ? 0 : a.order;
      var bo = b.order == null ? 0 : b.order;
      if (ao !== bo) return ao - bo;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  };

  util.groupBy = function (list, keyFn) {
    var out = {};
    list.forEach(function (item) {
      var k = keyFn(item);
      (out[k] = out[k] || []).push(item);
    });
    return out;
  };

  util.sum = function (list, fn) {
    return list.reduce(function (acc, item) {
      return acc + (fn ? fn(item) : item) || acc;
    }, 0);
  };

  util.debounce = function (fn, wait) {
    var t;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  };

  util.truncate = function (str, max) {
    var s = String(str == null ? "" : str);
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  };

  /** Stable colour for a subject index. */
  util.subjectColor = function (index) {
    return HDML.SUBJECT_COLORS[index % HDML.SUBJECT_COLORS.length];
  };

  util.taskTypeLabel = function (typeId) {
    for (var i = 0; i < HDML.TASK_TYPES.length; i++) {
      if (HDML.TASK_TYPES[i].id === typeId) return HDML.TASK_TYPES[i].label;
    }
    return "سایر";
  };

  util.taskTypeHasQuestions = function (typeId) {
    for (var i = 0; i < HDML.TASK_TYPES.length; i++) {
      if (HDML.TASK_TYPES[i].id === typeId) return HDML.TASK_TYPES[i].questions;
    }
    return false;
  };

  util.priorityLabel = function (p) {
    for (var i = 0; i < HDML.PRIORITIES.length; i++) {
      if (HDML.PRIORITIES[i].id === p) return HDML.PRIORITIES[i].label;
    }
    return "متوسط";
  };

  util.skipReasonLabel = function (id) {
    for (var i = 0; i < HDML.SKIP_REASONS.length; i++) {
      if (HDML.SKIP_REASONS[i].id === id) return HDML.SKIP_REASONS[i].label;
    }
    return "نامشخص";
  };

  util.trackLabel = function (id) {
    for (var i = 0; i < HDML.TRACKS.length; i++) {
      if (HDML.TRACKS[i].id === id) return HDML.TRACKS[i].label;
    }
    return id || "—";
  };

  util.examTypeLabel = function (id) {
    for (var i = 0; i < HDML.EXAM_TYPES.length; i++) {
      if (HDML.EXAM_TYPES[i].id === id) return HDML.EXAM_TYPES[i].label;
    }
    return "آزمون";
  };

  /** Achievement colour band shared by meters, rings and charts. */
  util.rateTone = function (rate) {
    if (rate === null || rate === undefined) return "muted";
    if (rate >= 90) return "success";
    if (rate >= 70) return "gold";
    if (rate >= 45) return "warning";
    return "danger";
  };

  util.toneColor = function (tone) {
    switch (tone) {
      case "success":
        return "#16875a";
      case "gold":
        return "#cead3a";
      case "warning":
        return "#b06f0a";
      case "danger":
        return "#c33232";
      default:
        return "#9aa4bb";
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
