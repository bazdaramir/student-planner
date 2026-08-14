(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var Q = HDML.query;
  var S = HDML.stats;
  var V = HDML.viewShared;
  var C = HDML.charts;
  var el = UI.el;

  HDML.views = HDML.views || {};

  HDML.views.progress = function (ctx) {
    var state = HDML.store.get();
    var week = Q.currentWeek(state);
    if (!week) return V.noPlan(ctx);

    var ws = S.weekStats(week.id);
    var box = el("div", {});

    box.appendChild(
      el("div", { class: "greet" }, [
        el("div", { class: "greet__hello", text: "پیشرفت من" }),
        el("div", { class: "greet__date", text: week.title + " — " + HDML.date.formatRange(week.startDate, week.endDate) })
      ])
    );

    var switcher = V.weekSwitcher();
    if (switcher) {
      box.appendChild(
        el("div", { class: "no-print", style: { "margin-bottom": "18px" } }, switcher)
      );
    }

    if (!S.hasAnyActivity(state)) {
      box.appendChild(
        UI.notice(
          "هنوز کاری را تیک نزدی. به‌محض اینکه اولین کار را انجام‌شده کنی، نمودارها اینجا ظاهر می‌شوند.",
          "info"
        )
      );
      return box;
    }

    box.appendChild(el("div", { class: "section-title", text: "📊 ساعت مطالعه این هفته" }));
    box.appendChild(
      el("div", { class: "simple-card" }, [
        el("div", { class: "big-stats" }, [
          bigStat(util.fmtHours(ws.actualMinutes), "ساعت خوندم"),
          bigStat(util.fmtHours(ws.plannedMinutes), "ساعت برنامه بود"),
          bigStat(util.fmtHours(ws.averageDailyMinutes), "ساعت میانگین روزانه")
        ]),
        el("div", { class: "divider" }),
        dayBars(ws.days),
        ws.bestDay
          ? el("div", {
              class: "simple-card__sub",
              style: { "margin-top": "14px" },
              text:
                "بهترین روزت " +
                ws.bestDay.dayName +
                " بود با " +
                util.fmtDur(ws.bestDay.actualMinutes) +
                " مطالعه."
            })
          : null
      ])
    );

    box.appendChild(el("div", { class: "section-title", text: "چقدر از برنامه انجام شد؟" }));
    box.appendChild(
      el("div", { class: "simple-card" }, [
        el("div", { class: "sbar" }, [
          el("div", { class: "sbar__top" }, [
            el("span", { class: "sbar__name", text: "زمان مطالعه" }),
            el("span", {
              class: "sbar__value",
              text:
                ws.studyAchievementRate === null ? "—" : util.fmtPct(ws.studyAchievementRate)
            })
          ]),
          UI.meter(ws.studyAchievementRate, { label: "زمان مطالعه", large: true })
        ]),
        el("div", { class: "sbar" }, [
          el("div", { class: "sbar__top" }, [
            el("span", { class: "sbar__name", text: "کارها" }),
            el("span", {
              class: "sbar__value",
              text: util.n(ws.completedTasks) + " از " + util.n(ws.totalTasks)
            })
          ]),
          UI.meter(ws.taskCompletionRate, { label: "کارها", large: true })
        ]),
        ws.targetQuestions
          ? el("div", { class: "sbar" }, [
              el("div", { class: "sbar__top" }, [
                el("span", { class: "sbar__name", text: "تست‌ها" }),
                el("span", {
                  class: "sbar__value",
                  text: util.n(ws.completedQuestions) + " از " + util.n(ws.targetQuestions)
                })
              ]),
              UI.meter(ws.questionCompletionRate, { label: "تست‌ها", large: true })
            ])
          : null,
        ws.accuracy !== null
          ? el("div", {
              class: "simple-card__sub",
              style: { "margin-top": "14px" },
              text: "از تست‌هایی که زدی، " + util.fmtPct(ws.accuracy) + " درست بوده."
            })
          : null
      ])
    );

    box.appendChild(el("div", { class: "section-title", text: "برای هر درس چقدر وقت گذاشتم؟" }));
    box.appendChild(
      el("div", { class: "simple-card" }, subjectBars(ws.bySubject))
    );

    var trend = S.trend({ limit: 28 });
    box.appendChild(el("div", { class: "section-title", text: "روند مطالعه" }));
    box.appendChild(el("div", { class: "simple-card" }, C.studyTrend(trend)));

    if (ws.skipped.length) {
      box.appendChild(el("div", { class: "section-title", text: "کارهایی که نشد" }));
      box.appendChild(
        el("div", { class: "simple-card" }, [
          el(
            "div",
            { class: "row" },
            ws.skipReasons.map(function (r) {
              return UI.badge(r.label + " × " + util.n(r.count), "warning");
            })
          ),
          el("div", {
            class: "simple-card__sub",
            style: { "margin-top": "12px" },
            text:
              "در مجموع " +
              util.n(ws.skipped.length) +
              " کار انجام نشد. این اطلاعات به مشاورت کمک می‌کند برنامه‌ی واقع‌بینانه‌تری بنویسد."
          })
        ])
      );
    }

    return box;
  };

  function bigStat(value, label) {
    return el("div", { class: "big-stat" }, [
      el("div", { class: "big-stat__value", text: value }),
      el("div", { class: "big-stat__label", text: label })
    ]);
  }

  /**
   * Study hours per day as plain labelled bars. On a phone this reads far
   * faster than a chart, and it can never overflow the screen.
   */
  function dayBars(days) {
    var max = days.reduce(function (m, d) {
      return Math.max(m, d.actualMinutes, d.plannedMinutes);
    }, 1);

    return el(
      "div",
      {},
      days.map(function (d) {
        var pct = Math.max(d.actualMinutes > 0 ? 3 : 0, (d.actualMinutes / max) * 100);
        return el("div", { class: "daybar" }, [
          el("span", { class: "daybar__name", text: d.dayName }),
          el("span", { class: "daybar__track" }, [
            el("span", {
              class: "daybar__fill",
              style: {
                width: pct + "%",
                background: d.actualMinutes >= d.plannedMinutes && d.plannedMinutes > 0
                  ? "var(--color-success)"
                  : "var(--color-blue)"
              }
            })
          ]),
          el("span", {
            class: "daybar__value",
            text: d.actualMinutes ? util.fmtHM(d.actualMinutes) : "—"
          })
        ]);
      })
    );
  }

  /** Plain labelled bars - easier to read at a glance than a radar. */
  function subjectBars(rows) {
    var data = (rows || []).filter(function (r) {
      return r.plannedMinutes > 0 || r.actualMinutes > 0;
    });

    if (!data.length) {
      return el("div", { class: "day-simple__empty", text: "هنوز مطالعه‌ای ثبت نشده." });
    }

    var max = data.reduce(function (m, r) {
      return Math.max(m, r.plannedMinutes, r.actualMinutes);
    }, 1);

    return data.map(function (r) {
      var width = Math.max(2, (r.actualMinutes / max) * 100);
      return el("div", { class: "sbar" }, [
        el("div", { class: "sbar__top" }, [
          el("span", { class: "sbar__name", text: r.name }),
          el("span", {
            class: "sbar__value",
            text:
              util.fmtHM(r.actualMinutes) +
              " از " +
              util.fmtHM(r.plannedMinutes) +
              (r.studyAchievementRate !== null
                ? "  (" + util.fmtPct(r.studyAchievementRate) + ")"
                : "")
          })
        ]),
        el("div", { class: "sbar__track" }, [
          el("div", {
            class: "sbar__fill",
            style: { width: width + "%", background: r.color }
          })
        ])
      ]);
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
