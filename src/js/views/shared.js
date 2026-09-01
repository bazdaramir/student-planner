(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var D = HDML.date;
  var A = HDML.actions;
  var Q = HDML.query;
  var S = HDML.stats;
  var el = UI.el;

  var V = (HDML.viewShared = {});

  V.weekSwitcher = function () {
    var state = HDML.store.get();
    var weeks = Q.weeksSorted(state);
    var current = Q.currentWeek(state);
    if (!weeks.length) return null;

    var index = weeks.findIndex(function (w) {
      return w.id === (current && current.id);
    });

    var select = el(
      "select",
      {
        class: "select",
        style: { width: "auto", border: "none", background: "transparent", "font-weight": "600" },
        "aria-label": "انتخاب هفته",
        onchange: function (e) {
          A.setUi({ currentWeekId: e.target.value, selectedDate: null });
        }
      },
      weeks.map(function (w) {
        return el("option", {
          value: w.id,
          text: w.title + " — " + D.formatRange(w.startDate, w.endDate)
        });
      })
    );
    if (current) select.value = current.id;

    return el("div", { class: "week-switch" }, [
      UI.iconButton("chevronRight", {
        title: "هفته‌ی قبل",
        disabled: index <= 0,
        onClick: function () {
          if (index > 0) A.setUi({ currentWeekId: weeks[index - 1].id, selectedDate: null });
        }
      }),
      select,
      UI.iconButton("chevronLeft", {
        title: "هفته‌ی بعد",
        disabled: index < 0 || index >= weeks.length - 1,
        onClick: function () {
          if (index >= 0 && index < weeks.length - 1)
            A.setUi({ currentWeekId: weeks[index + 1].id, selectedDate: null });
        }
      })
    ]);
  };

  V.dayStrip = function (weekId, selectedDate, onSelect) {
    var days = Q.daysOfWeek(weekId);
    if (!days.length) return null;
    var today = D.today();

    return el(
      "div",
      { class: "day-strip", role: "tablist", "aria-label": "روزهای هفته" },
      days.map(function (day) {
        var ds = S.dayStats(day.id);
        var tone =
          !ds || ds.totalTasks === 0
            ? "none"
            : ds.completedTasks === ds.totalTasks
            ? "done"
            : ds.completedTasks > 0
            ? "partial"
            : "none";

        return el(
          "button",
          {
            type: "button",
            class: "day-pill",
            role: "tab",
            "aria-pressed": day.date === selectedDate ? "true" : "false",
            "aria-selected": day.date === selectedDate ? "true" : "false",
            title:
              D.format(day.date, "full") +
              " — " +
              util.n(ds ? ds.completedTasks : 0) +
              " از " +
              util.n(ds ? ds.totalTasks : 0) +
              " فعالیت",
            onclick: function () {
              onSelect(day.date);
            }
          },
          [
            /* Both spellings ship; CSS shows whichever fits the screen. */
            el("div", { class: "day-pill__name day-pill__name--full", text: D.WEEK_DAYS[day.dowIndex] }),
            el("div", {
              class: "day-pill__name day-pill__name--short",
              text: D.WEEK_DAYS_SHORT[day.dowIndex]
            }),
            el("div", { class: "day-pill__date day-pill__date--full", text: D.format(day.date, "short") }),
            el("div", {
              class: "day-pill__date day-pill__date--short",
              text: util.n(D.jalaliOf(day.date).jd)
            }),
            el("div", { class: "day-pill__dot day-pill__dot--" + tone }),
            day.date === today ? el("div", { class: "day-pill__today", text: "امروز" }) : null
          ]
        );
      })
    );
  };

  /**
   * Shown whenever there is no week yet. For a student the answer is almost
   * always "import the file your consultant sent you".
   * @param {Object} [ctx] view context, used for the secondary action
   */
  V.noPlan = function (ctx) {
    return el("div", { class: "welcome" }, [
      el("img", { class: "welcome__logo", src: HDML.LOGO, alt: "ENIGMA" }),
      el("div", { class: "welcome__brand", text: "🔐 ENIGMA" }),
      el("div", { class: "welcome__hi", text: "سلام 👋" }),
      el("p", { class: "welcome__line", text: "هنوز برنامه‌ای برای این هفته نداری." }),
      el("p", {
        class: "welcome__line",
        text: "برنامه‌ای که مشاورت برات فرستاده رو از اینجا وارد کن."
      }),
      /* The picker itself, not a button that opens a dialog first: one tap
         on a phone goes straight to the native file chooser. */
      el("div", { class: "welcome__cta" }, [
        HDML.weekImport.picker({
          title: "دریافت برنامه جدید",
          hint: "برنامه هفتگی مشاورت رو از فایل انتخاب کن"
        })
      ]),
      ctx && ctx.navigate
        ? el("button", {
            type: "button",
            class: "welcome__alt",
            text: "یا خودم برنامه می‌سازم",
            onclick: function () {
              ctx.navigate("consultant");
            }
          })
        : null
    ]);
  };

  /** Debounced textarea that writes straight into the store. */
  V.noteEditor = function (config) {
    var save = util.debounce(function (value) {
      config.onSave(value);
    }, 500);

    var ta = el("textarea", {
      class: "textarea",
      rows: config.rows || 3,
      placeholder: config.placeholder || "",
      "aria-label": config.label,
      oninput: function (e) {
        save(e.target.value);
      }
    });
    ta.value = config.value || "";

    return el("div", { class: "field" }, [
      el("span", { class: "field__label", text: config.label }),
      ta,
      config.hint ? el("div", { class: "field__hint", text: config.hint }) : null
    ]);
  };

  V.runningBanner = function () {
    var runningId = A.runningTaskId();
    if (!runningId) return null;
    var task = HDML.store.get().consultant.tasks[runningId];
    if (!task) return null;

    return el("div", { class: "running-banner no-print" }, [
      el("div", {}, [
        el("div", { class: "running-banner__label", text: "در حال مطالعه" }),
        el("div", { class: "running-banner__title", text: task.title })
      ]),
      el("div", { style: { flex: "1" } }),
      el("div", { class: "timer-pill", dataset: { timerFor: runningId } }, [
        el("span", { class: "timer-pill__dot" }),
        el("span", {
          class: "timer-value",
          text: HDML.taskUI.formatClock(A.timerMinutes(runningId))
        })
      ]),
      UI.button("توقف و ثبت", {
        icon: "stop",
        size: "sm",
        variant: "gold",
        onClick: function () {
          A.stopTimer(runningId);
          UI.toast("زمان مطالعه ثبت شد.", "success");
        }
      })
    ]);
  };
})(typeof window !== "undefined" ? window : globalThis);
