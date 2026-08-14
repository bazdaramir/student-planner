(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var D = HDML.date;
  var A = HDML.actions;
  var Q = HDML.query;
  var S = HDML.stats;
  var V = HDML.viewShared;
  var T = HDML.taskUI;
  var el = UI.el;

  HDML.views = HDML.views || {};

  /* Pure view state - not persisted, not exported. */
  var open = {};

  HDML.views.week = function (ctx) {
    var state = HDML.store.get();
    var week = Q.currentWeek(state);

    if (!week) return V.noPlan(ctx);

    var ws = S.weekStats(week.id);
    var box = el("div", {});

    box.appendChild(
      el("div", { class: "greet" }, [
        el("div", { class: "greet__hello", text: week.title }),
        el("div", {
          class: "greet__date",
          text: D.formatRange(week.startDate, week.endDate)
        })
      ])
    );

    var switcher = V.weekSwitcher();
    if (switcher) {
      box.appendChild(
        el("div", { class: "no-print", style: { "margin-bottom": "18px" } }, switcher)
      );
    }

    box.appendChild(
      el("div", { class: "today-box" }, [
        el("div", { class: "today-box__row" }, [
          el("div", { class: "today-box__item" }, [
            el("div", { class: "today-box__q", text: "برنامه‌ی این هفته" }),
            el("div", { class: "today-box__a", text: util.fmtDur(ws.plannedMinutes) })
          ]),
          el("div", { class: "today-box__item" }, [
            el("div", { class: "today-box__q", text: "خوندی" }),
            el("div", { class: "today-box__a", text: util.fmtDur(ws.actualMinutes) })
          ])
        ]),
        UI.meter(ws.studyAchievementRate, { label: "پیشرفت هفته", large: true }),
        el("div", {
          class: "today-box__note",
          text:
            util.n(ws.completedTasks) +
            " کار از " +
            util.n(ws.totalTasks) +
            " کار انجام شده" +
            (ws.completedQuestions ? " · " + util.n(ws.completedQuestions) + " تست" : "")
        })
      ])
    );

    if (week.consultantNote) {
      box.appendChild(
        el("div", { style: { "margin-bottom": "18px" } },
          UI.noteBlock("پیام مشاور برای این هفته", week.consultantNote, "consultant"))
      );
    }

    box.appendChild(el("div", { class: "section-title", text: "روزهای هفته" }));

    ws.days.forEach(function (ds) {
      box.appendChild(dayRow(ds, ctx));
    });

    box.appendChild(
      el("div", { class: "no-print", style: { "margin-top": "22px" } }, [
        UI.button("📤 گزارش این هفته را بساز", {
          size: "lg",
          block: true,
          onClick: function () {
            ctx.navigate("reports", { reportType: "weekly", weekId: week.id });
          }
        })
      ])
    );

    return box;
  };

  function dayRow(ds, ctx) {
    var isOpen = !!open[ds.dayId];

    var head = el(
      "button",
      {
        type: "button",
        class: "day-simple__head",
        "aria-expanded": isOpen ? "true" : "false",
        onclick: function () {
          open[ds.dayId] = !isOpen;
          ctx.rerender();
        }
      },
      [
        el("div", { class: "day-simple__top" }, [
          el("span", { class: "day-simple__name", text: ds.dayName }),
          el("span", { class: "day-simple__date", text: D.format(ds.date, "medium") }),
          ds.isToday ? UI.badge("امروز", "type") : null,
          el("span", { class: "day-simple__summary" }, [
            ds.totalTasks
              ? el("span", {}, [
                  el("strong", { text: util.fmtHM(ds.actualMinutes) }),
                  el("span", { text: " از " }),
                  el("strong", { text: util.fmtHM(ds.plannedMinutes) }),
                  el("span", { text: " ساعت" })
                ])
              : el("span", { class: "text-muted", text: "بدون برنامه" })
          ])
        ]),
        ds.totalTasks
          ? el("div", { style: { "margin-top": "10px" } }, [
              UI.meter(ds.taskCompletionRate, { label: ds.dayName, large: true }),
              el("div", { class: "day-simple__foot" }, [
                el("span", {
                  class: "day-simple__date",
                  text:
                    util.n(ds.completedTasks) + " از " + util.n(ds.totalTasks) + " کار انجام شده"
                }),
                el("span", {
                  class: "day-simple__cta",
                  text: isOpen ? "بستن ▲" : "مشاهده برنامه ▼"
                })
              ])
            ])
          : null
      ]
    );

    var children = [head];

    if (isOpen) {
      var body = el("div", { class: "day-simple__body" });

      if (ds.consultantNote) {
        body.appendChild(UI.noteBlock("پیام مشاور", ds.consultantNote, "consultant"));
        body.appendChild(el("div", { style: { height: "12px" } }));
      }

      if (!ds.taskStats.length) {
        body.appendChild(
          el("div", { class: "day-simple__empty", text: "برای این روز کاری ثبت نشده." })
        );
      } else {
        body.appendChild(
          el(
            "div",
            {},
            ds.taskStats.map(function (ts) {
              return T.card(ts);
            })
          )
        );
        body.appendChild(
          el("div", { class: "no-print", style: { "margin-top": "14px" } }, [
            UI.button("رفتن به این روز", {
              block: true,
              onClick: function () {
                A.setUi({ selectedDate: ds.date });
                ctx.navigate("today");
              }
            })
          ])
        );
      }

      if (ds.note) {
        body.appendChild(el("div", { style: { height: "12px" } }));
        body.appendChild(UI.noteBlock("یادداشت تو", ds.note, "student"));
      }

      children.push(body);
    }

    return el(
      "div",
      { class: "day-simple" + (ds.isToday ? " is-today" : "") },
      children
    );
  }
})(typeof window !== "undefined" ? window : globalThis);
