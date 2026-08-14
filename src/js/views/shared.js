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
   * The three components are always shown separately - never collapsed into
   * one meaningless number (the composite score is labelled and explained).
   */
  V.kpiRow = function (agg, options) {
    var opts = options || {};
    var items = [
      UI.kpi({
        label: "زمان مطالعه",
        icon: "clock",
        value: util.fmtDur(agg.actualMinutes),
        foot: [
          el("span", {
            text: "از " + util.fmtDur(agg.plannedMinutes) + " برنامه"
          }),
          agg.hasEstimatedTime
            ? UI.badge("شامل برآورد", "warning", {
                title:
                  util.fmtDur(agg.estimatedMinutes) +
                  " از این زمان، برآورد از زمان برنامه است چون دانش‌آموز زمان واقعی را ثبت نکرده."
              })
            : null
        ],
        rate: agg.studyAchievementRate
      }),
      UI.kpi({
        label: "فعالیت‌ها",
        icon: "today",
        value: util.n(agg.completedTasks) + " / " + util.n(agg.totalTasks),
        foot: [
          agg.skippedTasks
            ? UI.badge(util.n(agg.skippedTasks) + " انجام‌نشد", "warning")
            : null,
          agg.pendingTasks
            ? el("span", { text: util.n(agg.pendingTasks) + " باقی‌مانده" })
            : null
        ],
        rate: agg.taskCompletionRate
      }),
      UI.kpi({
        label: "تست",
        icon: "target",
        value:
          agg.targetQuestions || agg.completedQuestions
            ? util.n(agg.completedQuestions) + " / " + util.n(agg.targetQuestions)
            : "—",
        foot: [
          agg.accuracy !== null
            ? el("span", { text: "درصد صحیح: " + util.fmtPct(agg.accuracy) })
            : el("span", { class: "text-muted", text: "بدون داده‌ی تست" })
        ],
        rate: agg.questionCompletionRate
      })
    ];

    if (opts.showScore !== false) {
      items.push(
        UI.kpi({
          label: "امتیاز کلی",
          icon: "sparkle",
          gold: true,
          value: agg.overallScore === null ? "—" : util.fmtPct(agg.overallScore),
          foot: [
            el("span", {
              class: "text-xs",
              text:
                agg.overallScore === null
                  ? "بدون داده"
                  : "میانگین " + util.n(agg.overallParts) + " شاخص بالا"
            })
          ],
          rate: agg.overallScore
        })
      );
    }

    return el("div", { class: "grid grid--kpi" }, items);
  };

  /**
   * "Subject | Planned | Actual | Difference | Achievement" - the study-time
   * table from the reference sheet, filled automatically from task logs.
   */
  V.subjectTable = function (rows, options) {
    var opts = options || {};
    if (!rows || !rows.length) {
      return UI.empty({
        icon: "book",
        title: "هنوز مطالعه‌ای ثبت نشده است",
        text: "با تکمیل فعالیت‌ها، زمان هر درس به‌صورت خودکار در این جدول محاسبه می‌شود."
      });
    }

    var totals = rows.reduce(
      function (acc, r) {
        acc.planned += r.plannedMinutes;
        acc.actual += r.actualMinutes;
        acc.questions += r.completedQuestions;
        acc.target += r.targetQuestions;
        return acc;
      },
      { planned: 0, actual: 0, questions: 0, target: 0 }
    );

    function deltaCell(delta) {
      var cls = delta > 0 ? "delta--pos" : delta < 0 ? "delta--neg" : "delta--zero";
      return el("td", { class: "num-cell" }, [
        el("span", { class: "delta " + cls, text: util.fmtDelta(delta) })
      ]);
    }

    return el("div", { class: "table-wrap" }, [
      el("table", { class: "data-table" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { text: "درس" }),
            el("th", { class: "num-cell", text: "برنامه" }),
            el("th", { class: "num-cell", text: "واقعی" }),
            el("th", { class: "num-cell", text: "اختلاف" }),
            el("th", { class: "num-cell", text: "تحقق" }),
            opts.showQuestions !== false
              ? el("th", { class: "num-cell", text: "تست" })
              : null
          ])
        ]),
        el(
          "tbody",
          {},
          rows.map(function (r) {
            return el("tr", {}, [
              el("td", {}, [
                el("span", { class: "cell-subject" }, [
                  UI.subjectBadge(r.name, r.color)
                ])
              ]),
              el("td", { class: "num-cell", text: util.fmtHM(r.plannedMinutes) }),
              el("td", { class: "num-cell", text: util.fmtHM(r.actualMinutes) }),
              deltaCell(r.deltaMinutes),
              el("td", { class: "num-cell" }, [
                el("div", { style: { "min-width": "84px" } }, [
                  el("span", {
                    text:
                      r.studyAchievementRate === null
                        ? "—"
                        : util.fmtPct(r.studyAchievementRate)
                  }),
                  UI.meter(r.studyAchievementRate, { label: r.name })
                ])
              ]),
              opts.showQuestions !== false
                ? el("td", { class: "num-cell" }, [
                    r.targetQuestions || r.completedQuestions
                      ? el("span", {
                          text:
                            util.n(r.completedQuestions) +
                            " / " +
                            util.n(r.targetQuestions)
                        })
                      : el("span", { class: "text-muted", text: "—" })
                  ])
                : null
            ]);
          })
        ),
        el("tfoot", {}, [
          el("tr", {}, [
            el("td", { text: "مجموع" }),
            el("td", { class: "num-cell", text: util.fmtHM(totals.planned) }),
            el("td", { class: "num-cell", text: util.fmtHM(totals.actual) }),
            deltaCell(totals.actual - totals.planned),
            el("td", {
              class: "num-cell",
              text:
                totals.planned > 0
                  ? util.fmtPct(util.pct(totals.actual, totals.planned))
                  : "—"
            }),
            opts.showQuestions !== false
              ? el("td", {
                  class: "num-cell",
                  text: util.n(totals.questions) + " / " + util.n(totals.target)
                })
              : null
          ])
        ])
      ])
    ]);
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

  V.skipSummary = function (reasons, skipped) {
    if (!skipped || !skipped.length) return null;
    return el("div", { class: "stack" }, [
      el(
        "div",
        { class: "row" },
        reasons.map(function (r) {
          return UI.badge(r.label + " × " + util.n(r.count), "warning");
        })
      ),
      el(
        "div",
        { class: "stack stack--sm" },
        skipped.map(function (ts) {
          return el("div", { class: "report-task-line" }, [
            el("span", {
              class: "report-task-line__mark report-task-line__mark--skip",
              text: "×"
            }),
            el("span", { class: "report-task-line__body" }, [
              el("strong", { text: Q.subjectName(ts.task.subjectId) + " — " }),
              el("span", { text: ts.task.title }),
              ts.log && ts.log.skipNote
                ? el("span", { class: "text-muted", text: " — " + ts.log.skipNote })
                : null
            ]),
            el("span", {
              class: "report-task-line__num",
              text: util.skipReasonLabel(ts.skipReason)
            })
          ]);
        })
      )
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
