/* ==========================================================================
   week-import.js - "وارد کردن برنامه جدید"

   The consultant prepares next week as a small, human-readable JSON file
   (see examples/ENIGMA-Week-03.json). The student picks the file and the week
   appears in the app. After importing, the HTML no longer needs the JSON.
   ========================================================================== */
(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var D = HDML.date;
  var A = HDML.actions;
  var el = UI.el;

  var W = (HDML.weekImport = {});

  /* Persian day names -> index (Saturday = 0), plus a few spellings. */
  var DAY_ALIASES = {
    "شنبه": 0,
    "يكشنبه": 1,
    "یکشنبه": 1,
    "یک‌شنبه": 1,
    "دوشنبه": 2,
    "دو‌شنبه": 2,
    "سه‌شنبه": 3,
    "سه شنبه": 3,
    "سهشنبه": 3,
    "چهارشنبه": 4,
    "چهار‌شنبه": 4,
    "پنجشنبه": 5,
    "پنج‌شنبه": 5,
    "پنج شنبه": 5,
    "جمعه": 6
  };

  /* Friendly Persian task types -> internal ids. */
  var TYPE_ALIASES = {
    "درس": "study",
    "مطالعه": "study",
    "درسنامه": "study",
    "تست": "practice",
    "تمرین": "practice",
    "آزمونک": "test",
    "دوره": "review",
    "مرور": "review",
    "جمع‌بندی": "summary",
    "جمع بندی": "summary",
    "خلاصه‌نویسی": "summary",
    "تحلیل آزمون": "exam_analysis",
    "سایر": "other"
  };

  W.DAY_ALIASES = DAY_ALIASES;
  W.TYPE_ALIASES = TYPE_ALIASES;

  function normalizeDay(value, fallbackIndex) {
    if (typeof value === "number" && value >= 0 && value <= 6) return value;
    var key = String(value == null ? "" : value).trim().replace(/\s+/g, " ");
    if (DAY_ALIASES[key] !== undefined) return DAY_ALIASES[key];
    var stripped = key.replace(/[‌\s]/g, "");
    var names = Object.keys(DAY_ALIASES);
    for (var i = 0; i < names.length; i++) {
      if (names[i].replace(/[‌\s]/g, "") === stripped) return DAY_ALIASES[names[i]];
    }
    return fallbackIndex === undefined ? null : fallbackIndex;
  }

  function normalizeType(value) {
    var key = String(value == null ? "" : value).trim();
    if (!key) return "study";
    if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
    for (var i = 0; i < HDML.TASK_TYPES.length; i++) {
      if (HDML.TASK_TYPES[i].id === key) return key;
    }
    return "study";
  }

  /** Accepts "1405/06/07", "۱۴۰۵/۰۶/۰۷" or a Gregorian "2026-08-29". */
  function normalizeStartDate(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return null;
    if (D.isValidISO(raw)) return D.weekStart(raw);
    var iso = D.jalaliInputToISO(raw);
    return iso ? D.weekStart(iso) : null;
  }

  /**
   * Validates and normalises a plan file.
   * @returns {{ok:boolean, errors:string[], warnings:string[], plan?:Object}}
   */
  W.parse = function (raw) {
    var errors = [];
    var warnings = [];

    if (!util.isObject(raw)) {
      return { ok: false, errors: ["فایل انتخاب‌شده یک فایل برنامه‌ی معتبر نیست."], warnings: [] };
    }

    /* An activity or backup file is a different thing - say so clearly. */
    if (raw.kind === "hdml-activity" || raw.kind === "hdml-backup") {
      return {
        ok: false,
        errors: [
          "این فایل، فایل برنامه‌ی هفته نیست (فایل عملکرد یا پشتیبان است). از بخش تنظیمات استفاده کنید."
        ],
        warnings: []
      };
    }

    var weekBlock = util.isObject(raw.week) ? raw.week : {};
    var daysRaw = raw.days;
    if (!Array.isArray(daysRaw) || !daysRaw.length) {
      errors.push("در این فایل هیچ روزی تعریف نشده است (بخش days خالی است).");
    }

    var startDate = normalizeStartDate(weekBlock.startDate || raw.startDate);
    if (!startDate) {
      errors.push(
        "تاریخ شروع هفته نامعتبر است. نمونه‌ی درست: \"startDate\": \"۱۴۰۵/۰۶/۰۷\""
      );
    }

    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    var days = [];
    var totalTasks = 0;
    var totalMinutes = 0;
    var subjects = {};
    var usedDow = {};

    daysRaw.forEach(function (dayRaw, index) {
      if (!util.isObject(dayRaw)) {
        warnings.push("روز شماره‌ی " + util.n(index + 1) + " نادیده گرفته شد (ساختار نادرست).");
        return;
      }
      var dow = normalizeDay(dayRaw.day !== undefined ? dayRaw.day : dayRaw.name, null);
      if (dow === null) {
        warnings.push(
          "نام روز «" + util.escapeHtml(String(dayRaw.day || "")) + "» شناخته نشد و نادیده گرفته شد."
        );
        return;
      }
      if (usedDow[dow]) {
        warnings.push("روز «" + D.WEEK_DAYS[dow] + "» بیش از یک بار آمده و ادغام شد.");
      }
      usedDow[dow] = true;

      var tasksRaw = Array.isArray(dayRaw.tasks) ? dayRaw.tasks : [];
      var tasks = [];

      tasksRaw.forEach(function (t, ti) {
        if (!util.isObject(t)) return;
        var title = String(t.title || t.task || "").trim();
        if (!title) {
          warnings.push(
            "یک فعالیت در روز «" + D.WEEK_DAYS[dow] + "» بدون عنوان بود و نادیده گرفته شد."
          );
          return;
        }
        var minutes = util.toInt(
          t.minutes !== undefined ? t.minutes : t.plannedMinutes,
          0
        );
        if (minutes < 0 || minutes > 1440) {
          warnings.push(
            "زمان فعالیت «" + util.escapeHtml(title) + "» نامعتبر بود و صفر در نظر گرفته شد."
          );
          minutes = 0;
        }
        var questions = util.toInt(
          t.questions !== undefined ? t.questions : t.targetQuestions,
          0
        );
        if (questions < 0) questions = 0;

        var subject = String(t.subject || "سایر").trim() || "سایر";
        subjects[subject] = true;

        tasks.push({
          subject: subject,
          topic: String(t.topic || "").trim(),
          title: title,
          description: String(t.description || "").trim(),
          type: normalizeType(t.type),
          plannedMinutes: minutes,
          targetQuestions: questions,
          startTime: String(t.startTime || t.time || "").trim(),
          priority: t.priority === "high" || t.priority === "زیاد" ? "high" : "normal",
          note: String(t.note || t.consultantNote || "").trim()
        });

        totalTasks += 1;
        totalMinutes += minutes;
      });

      days.push({
        dowIndex: dow,
        note: String(dayRaw.note || "").trim(),
        tasks: tasks
      });
    });

    if (!totalTasks) {
      return {
        ok: false,
        errors: ["در این فایل هیچ فعالیتی پیدا نشد."],
        warnings: warnings
      };
    }

    var studentBlock = util.isObject(raw.student) ? raw.student : {};

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      plan: {
        title: String(weekBlock.title || raw.title || "").trim() || "هفته‌ی جدید",
        startDate: startDate,
        endDate: D.addDays(startDate, 6),
        weekNote: String(weekBlock.note || "").trim(),
        studentName: String(studentBlock.name || raw.studentName || "").trim(),
        consultantName: String(studentBlock.consultant || raw.consultantName || "").trim(),
        days: days,
        summary: {
          tasks: totalTasks,
          minutes: totalMinutes,
          days: days.filter(function (d) {
            return d.tasks.length;
          }).length,
          subjects: Object.keys(subjects)
        }
      }
    };
  };

  /**
   * Reads a chosen file and routes it to the preview or an error dialog.
   * Everything is local: FileReader only, never a network request.
   */
  function handleFile(file) {
    if (!file) return;

    if (!/\.json$/i.test(file.name) && file.type.indexOf("json") < 0) {
      showErrorDialog([
        "فایل انتخاب‌شده «" +
          util.escapeHtml(file.name) +
          "» یک فایل برنامه (json.) نیست."
      ]);
      return;
    }

    var reader;
    try {
      reader = new global.FileReader();
    } catch (err) {
      showErrorDialog(["مرورگر شما امکان خواندن فایل را ندارد."]);
      return;
    }

    reader.onload = function () {
      var raw;
      try {
        raw = JSON.parse(String(reader.result));
      } catch (err) {
        showErrorDialog(["فایل انتخاب‌شده خراب است و خوانده نشد."]);
        return;
      }
      var parsed = W.parse(raw);
      if (!parsed.ok) {
        showErrorDialog(parsed.errors, parsed.warnings);
        return;
      }
      showPreviewDialog(parsed);
    };

    reader.onerror = function () {
      showErrorDialog(["خواندن فایل ممکن نشد. دوباره تلاش کن."]);
    };

    try {
      reader.readAsText(file);
    } catch (err) {
      showErrorDialog(["خواندن فایل ممکن نشد: " + (err.message || "")]);
    }
  }

  /**
   * A big, obviously tappable control that IS the file input.
   *
   * Deliberately a <label> wrapping a hidden <input type="file">: tapping a
   * label natively opens the OS file picker on Android and iOS with a single
   * tap, with no scripted .click() that a mobile browser might block for not
   * being a trusted gesture.
   *
   * @param {{title:string, hint?:string, small?:boolean}} config
   */
  W.picker = function (config) {
    var input = el("input", {
      type: "file",
      accept: ".json,application/json",
      class: "file-input",
      /* Re-selecting the same file must still fire change. */
      onclick: function (e) {
        e.target.value = "";
      },
      onchange: function (e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = "";
        handleFile(file);
      }
    });

    return el(
      "label",
      { class: "file-cta" + (config.small ? " file-cta--small" : "") },
      [
        el("span", { class: "file-cta__icon", text: "📥" }),
        el("span", { class: "file-cta__body" }, [
          el("span", { class: "file-cta__title", text: config.title }),
          config.hint ? el("span", { class: "file-cta__hint", text: config.hint }) : null
        ]),
        input
      ]
    );
  };

  function showErrorDialog(errors, warnings) {
    UI.openModal({
      title: "این فایل خوانده نشد",
      body: el("div", { class: "stack" }, [
        el(
          "div",
          { class: "stack stack--sm" },
          (errors || []).map(function (msg) {
            return UI.notice(util.escapeHtml(msg), "danger");
          })
        ),
        el(
          "div",
          { class: "stack stack--sm" },
          (warnings || []).map(function (msg) {
            return UI.notice(util.escapeHtml(msg), "warning");
          })
        ),
        UI.notice("هیچ تغییری در برنامه‌ی فعلی تو ایجاد نشد.", "info"),
        W.picker({ title: "انتخاب یک فایل دیگر", small: true })
      ]),
      footer: [UI.button("بستن", { onClick: UI.closeModal })]
    });
  }

  function showPreviewDialog(parsed) {
    var plan = parsed.plan;

    var body = el("div", { class: "stack" }, [
      UI.notice("فایل سالم است. یک نگاه بینداز و بعد تأیید کن.", "success"),
      el(
        "div",
        { class: "stack stack--sm" },
        parsed.warnings.map(function (msg) {
          return UI.notice(util.escapeHtml(msg), "warning");
        })
      ),
      el("div", { class: "simple-card" }, [
        el("div", { class: "simple-card__title", text: plan.title }),
        el("div", {
          class: "simple-card__sub",
          text: D.formatRange(plan.startDate, plan.endDate)
        }),
        el("div", { class: "big-stats", style: { "margin-top": "14px" } }, [
          bigStat(util.n(plan.summary.tasks), "کار"),
          bigStat(util.fmtHours(plan.summary.minutes), "ساعت"),
          bigStat(util.n(plan.summary.days), "روز")
        ]),
        el(
          "div",
          { class: "row", style: { "margin-top": "14px" } },
          plan.summary.subjects.slice(0, 12).map(function (name) {
            return UI.badge(name, "muted");
          })
        )
      ]),
      el(
        "div",
        { class: "stack stack--sm" },
        plan.days
          .filter(function (d) {
            return d.tasks.length;
          })
          .map(function (d) {
            var minutes = d.tasks.reduce(function (a, t) {
              return a + t.plannedMinutes;
            }, 0);
            return el("div", { class: "kv" }, [
              el("span", { class: "kv__key", text: D.WEEK_DAYS[d.dowIndex] }),
              el("span", {
                class: "kv__value",
                text: util.n(d.tasks.length) + " کار · " + util.fmtHM(minutes)
              })
            ]);
          })
      )
    ]);

    UI.openModal({
      title: "برنامه‌ی جدید",
      subtitle: plan.title,
      body: body,
      footer: [
        UI.button("بستن", { onClick: UI.closeModal }),
        UI.button("وارد کن", {
          variant: "primary",
          size: "lg",
          icon: "check",
          onClick: function () {
            var weekId = A.createWeekFromPlan(plan);
            A.setUi({ currentWeekId: weekId, selectedDate: null });
            UI.closeModal();
            UI.toast("برنامه‌ی جدید اضافه شد.", "success");
            if (HDML.app) HDML.app.navigate("week");
          }
        })
      ]
    });
  }

  W.handleFile = handleFile;

  /** Menu route: a sheet whose main content is the one-tap picker. */
  W.openDialog = function () {
    UI.openModal({
      title: "دریافت برنامه جدید",
      body: el("div", { class: "stack" }, [
        W.picker({
          title: "دریافت برنامه جدید",
          hint: "فایل برنامه‌ی هفتگی (json.) را از گوشی‌ات انتخاب کن"
        }),
        UI.notice(
          "برنامه‌های قبلی‌ات پاک نمی‌شوند؛ هفته‌ی جدید به برنامه اضافه می‌شود.",
          "info"
        )
      ]),
      footer: [UI.button("بستن", { onClick: UI.closeModal })]
    });
  };

  function bigStat(value, label) {
    return el("div", { class: "big-stat" }, [
      el("div", { class: "big-stat__value", text: value }),
      el("div", { class: "big-stat__label", text: label })
    ]);
  }
})(typeof window !== "undefined" ? window : globalThis);
