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
  var C = HDML.charts;
  var el = UI.el;

  HDML.views = HDML.views || {};
  var R = (HDML.reports = {});

  /* View-local selection state. */
  var mode = "daily";
  var selectedDate = null;
  var includeConsultant = true;

  HDML.views.reports = function (ctx) {
    var state = HDML.store.get();
    var week = Q.currentWeek(state);
    var container = el("div", {});

    if (!week) return V.noPlan(ctx);

    /* Honour navigation params (e.g. "گزارش امروز" from the Today view). */
    if (ctx.params) {
      if (ctx.params.reportType) mode = ctx.params.reportType;
      if (ctx.params.date) selectedDate = ctx.params.date;
      if (ctx.params.weekId && ctx.params.weekId !== week.id) {
        A.setUi({ currentWeekId: ctx.params.weekId });
      }
      ctx.params = null;
    }

    var days = Q.daysOfWeek(week.id);
    if (
      !selectedDate ||
      !days.some(function (d) {
        return d.date === selectedDate;
      })
    ) {
      var today = D.today();
      selectedDate = days.some(function (d) {
        return d.date === today;
      })
        ? today
        : days.length
        ? days[0].date
        : null;
    }

    var reportHost = el("div", { id: "report-host" });

    function renderReport() {
      UI.clear(reportHost);
      var node =
        mode === "daily"
          ? R.buildDaily(Q.dayByDate(selectedDate).id, { includeConsultant: includeConsultant })
          : R.buildWeekly(week.id, { includeConsultant: includeConsultant });
      reportHost.appendChild(node);
    }

    container.appendChild(
      el("div", { class: "greet" }, [
        el("div", { class: "greet__hello", text: "گزارش من" }),
        el("div", {
          class: "greet__date",
          text: "گزارش خودکار ساخته می‌شود؛ کافی است بفرستی برای مشاورت."
        })
      ])
    );

    container.appendChild(
      el("div", { class: "big-choice no-print", style: { "margin-bottom": "18px" } }, [
        el(
          "button",
          {
            type: "button",
            class: "big-choice__btn",
            "aria-pressed": mode === "daily" ? "true" : "false",
            onclick: function () {
              mode = "daily";
              ctx.rerender();
            }
          },
          [
            el("div", { class: "big-choice__emoji", text: "📄" }),
            el("div", { class: "big-choice__label", text: "گزارش امروز" }),
            el("div", { class: "big-choice__hint", text: "یک روز" })
          ]
        ),
        el(
          "button",
          {
            type: "button",
            class: "big-choice__btn",
            "aria-pressed": mode === "weekly" ? "true" : "false",
            onclick: function () {
              mode = "weekly";
              ctx.rerender();
            }
          },
          [
            el("div", { class: "big-choice__emoji", text: "🗓" }),
            el("div", { class: "big-choice__label", text: "گزارش این هفته" }),
            el("div", { class: "big-choice__hint", text: "کل هفته" })
          ]
        )
      ])
    );

    if (mode === "daily") {
      container.appendChild(
        el("div", { class: "no-print", style: { "margin-bottom": "18px" } }, [
          V.dayStrip(week.id, selectedDate, function (date) {
            selectedDate = date;
            ctx.rerender();
          })
        ])
      );
    }

    container.appendChild(
      el("div", { class: "btn-row no-print", style: { "margin-bottom": "20px" } }, [
        UI.button("🖨 چاپ یا ذخیره PDF", {
          variant: "navy",
          size: "lg",
          onClick: function () {
            R.print();
          }
        }),
        UI.button("💾 ذخیره به‌صورت فایل", {
          size: "lg",
          onClick: function () {
            R.exportHtml(reportHost.firstChild, reportTitle());
          }
        })
      ])
    );

    container.appendChild(reportHost);
    renderReport();

    function reportTitle() {
      return mode === "daily"
        ? "گزارش روزانه " + D.format(selectedDate, "long")
        : "گزارش هفتگی " + week.title;
    }

    return container;
  };

  function masthead(title, subtitle) {
    return el("div", { class: "report-masthead" }, [
      el("img", { class: "report-masthead__logo", src: HDML.LOGO, alt: "لوگو" }),
      el("div", { class: "report-masthead__center" }, [
        el("div", { class: "report-masthead__title", text: title }),
        el("div", { class: "report-masthead__sub", text: subtitle })
      ]),
      el("img", { class: "report-masthead__logo", src: HDML.LOGO, alt: "لوگو" })
    ]);
  }

  /** The identity bar from the top of the reference sheet. */
  function identityBar(state, extra) {
    var p = state.consultant.student;
    var cells = [
      { label: "نام و نام خانوادگی", value: Q.studentFullName(state) },
      { label: "پایه", value: p.grade || "—" },
      { label: "رشته", value: util.trackLabel(p.track) },
      { label: "مشاور", value: p.consultantName || "—" }
    ].concat(extra || []);

    return el(
      "div",
      { class: "report-identity" },
      cells.map(function (c) {
        return el("div", { class: "report-identity__cell" }, [
          el("div", { class: "report-identity__label", text: c.label }),
          el("div", { class: "report-identity__value", text: c.value })
        ]);
      })
    );
  }

  function section(title, body, opts) {
    var o = opts || {};
    if (!body) return null;
    return el(
      "section",
      { class: "report-section" + (o.break ? " report-section--break" : "") },
      [el("h3", { class: "report-section__title", text: title }), body]
    );
  }

  function kpiGrid(items) {
    return el(
      "div",
      { class: "report-kpis" },
      items.map(function (item) {
        return el("div", { class: "report-kpi" }, [
          el("div", { class: "report-kpi__label", text: item.label }),
          el("div", { class: "report-kpi__value", text: item.value }),
          item.sub ? el("div", { class: "report-kpi__sub", text: item.sub }) : null
        ]);
      })
    );
  }

  function taskLines(list) {
    if (!list.length) return null;
    return el(
      "div",
      {},
      list.map(function (ts) {
        var mark = ts.isCompleted ? "✓" : ts.isSkipped ? "×" : "○";
        var cls = ts.isCompleted ? "done" : ts.isSkipped ? "skip" : "pending";
        var numbers = [];
        if (ts.actualMinutes > 0 || ts.plannedMinutes > 0) {
          numbers.push(
            util.fmtHM(ts.actualMinutes) + " / " + util.fmtHM(ts.plannedMinutes)
          );
        }
        if (ts.questionsCompleted || ts.targetQuestions) {
          numbers.push(
            util.n(ts.questionsCompleted) + "/" + util.n(ts.targetQuestions) + " تست"
          );
        }
        if (ts.accuracy !== null) numbers.push(util.fmtPct(ts.accuracy) + " صحیح");
        if (ts.isEstimated) numbers.push("برآوردی");

        return el("div", { class: "report-task-line" }, [
          el("span", {
            class: "report-task-line__mark report-task-line__mark--" + cls,
            text: mark
          }),
          el("span", { class: "report-task-line__body" }, [
            el("strong", { text: Q.subjectName(ts.task.subjectId) + " · " }),
            el("span", { text: ts.task.title }),
            ts.task.topic
              ? el("span", { class: "text-muted", text: " — " + ts.task.topic })
              : null,
            ts.isSkipped
              ? el("span", {
                  class: "text-muted",
                  text: " — دلیل: " + util.skipReasonLabel(ts.skipReason)
                })
              : null
          ]),
          el("span", { class: "report-task-line__num", text: numbers.join(" · ") })
        ]);
      })
    );
  }

  function subjectTableForReport(rows) {
    if (!rows.length) return null;
    var totals = rows.reduce(
      function (acc, r) {
        acc.planned += r.plannedMinutes;
        acc.actual += r.actualMinutes;
        acc.q += r.completedQuestions;
        acc.t += r.targetQuestions;
        return acc;
      },
      { planned: 0, actual: 0, q: 0, t: 0 }
    );

    return el("table", { class: "report-table" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", { text: "درس" }),
          el("th", { text: "برنامه" }),
          el("th", { text: "واقعی" }),
          el("th", { text: "اختلاف" }),
          el("th", { text: "تحقق" }),
          el("th", { text: "تست" })
        ])
      ]),
      el(
        "tbody",
        {},
        rows.map(function (r) {
          return el("tr", {}, [
            el("td", { text: r.name }),
            el("td", { text: util.fmtHM(r.plannedMinutes) }),
            el("td", { text: util.fmtHM(r.actualMinutes) }),
            el("td", { text: util.fmtDelta(r.deltaMinutes) }),
            el("td", {
              text:
                r.studyAchievementRate === null
                  ? "—"
                  : util.fmtPct(r.studyAchievementRate)
            }),
            el("td", {
              text:
                r.targetQuestions || r.completedQuestions
                  ? util.n(r.completedQuestions) + " / " + util.n(r.targetQuestions)
                  : "—"
            })
          ]);
        })
      ),
      el("tfoot", {}, [
        el("tr", {}, [
          el("td", { text: "مجموع" }),
          el("td", { text: util.fmtHM(totals.planned) }),
          el("td", { text: util.fmtHM(totals.actual) }),
          el("td", { text: util.fmtDelta(totals.actual - totals.planned) }),
          el("td", {
            text: totals.planned ? util.fmtPct(util.pct(totals.actual, totals.planned)) : "—"
          }),
          el("td", { text: util.n(totals.q) + " / " + util.n(totals.t) })
        ])
      ])
    ]);
  }

  function reportFoot(state) {
    return el("div", { class: "report-foot" }, [
      el("span", {
        text: "تاریخ تهیه‌ی گزارش: " + D.format(D.today(), "full")
      }),
      el("span", { text: Q.studentFullName(state) }),
      el("span", { text: "سامانه‌ی برنامه‌ریزی و گزارش عملکرد" })
    ]);
  }

  function wrapDoc(children) {
    var doc = el("div", { class: "report-doc" }, [
      el("div", { class: "report-doc__inner" }, children)
    ]);

    /* Reports stay detailed (they are meant for the consultant), but a wide
       table must scroll inside its own box - never push the phone sideways. */
    var tables = doc.querySelectorAll("table.report-table");
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      var wrap = el("div", { class: "report-table-wrap" });
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
    return doc;
  }

  R.buildDaily = function (dayId, options) {
    var opts = options || {};
    var state = HDML.store.get();
    var ds = S.dayStats(dayId);
    if (!ds) return UI.empty({ title: "این روز پیدا نشد" });

    var week = state.consultant.weeks[ds.weekId];
    var completed = ds.taskStats.filter(function (t) {
      return t.isCompleted;
    });
    var notDone = ds.taskStats.filter(function (t) {
      return !t.isCompleted;
    });

    return wrapDoc([
      masthead("گزارش عملکرد روزانه", D.format(ds.date, "full")),
      identityBar(state, [
        { label: "هفته", value: week ? week.title : "—" },
        { label: "تاریخ", value: D.format(ds.date, "numeric") }
      ]),

      section(
        "شاخص‌های کلیدی این روز",
        kpiGrid([
          {
            label: "زمان برنامه‌ریزی‌شده",
            value: util.fmtHM(ds.plannedMinutes),
            sub: util.fmtDur(ds.plannedMinutes)
          },
          {
            label: "زمان واقعی مطالعه",
            value: util.fmtHM(ds.actualMinutes),
            sub: ds.hasEstimatedTime
              ? util.fmtHM(ds.estimatedMinutes) + " برآوردی"
              : "کاملاً ثبت‌شده"
          },
          {
            label: "تحقق مطالعه",
            value:
              ds.studyAchievementRate === null ? "—" : util.fmtPct(ds.studyAchievementRate),
            sub: "واقعی ÷ برنامه"
          },
          {
            label: "فعالیت‌ها",
            value: util.n(ds.completedTasks) + " / " + util.n(ds.totalTasks),
            sub:
              ds.taskCompletionRate === null
                ? "بدون فعالیت"
                : util.fmtPct(ds.taskCompletionRate) + " انجام‌شده"
          },
          {
            label: "تست",
            value:
              ds.targetQuestions || ds.completedQuestions
                ? util.n(ds.completedQuestions) + " / " + util.n(ds.targetQuestions)
                : "—",
            sub:
              ds.questionCompletionRate === null
                ? "بدون هدف تست"
                : util.fmtPct(ds.questionCompletionRate) + " تحقق"
          },
          {
            label: "درست / غلط / نزده",
            value:
              util.n(ds.correct) + " / " + util.n(ds.wrong) + " / " + util.n(ds.unanswered),
            sub: ds.accuracy !== null ? "درصد صحیح " + util.fmtPct(ds.accuracy) : "—"
          },
          {
            label: "انجام‌نشده",
            value: util.n(ds.skippedTasks + ds.pendingTasks),
            sub:
              util.n(ds.skippedTasks) + " با دلیل · " + util.n(ds.pendingTasks) + " بدون اقدام"
          },
          {
            label: "امتیاز کلی",
            value: ds.overallScore === null ? "—" : util.fmtPct(ds.overallScore),
            sub: "میانگین شاخص‌های بالا"
          }
        ])
      ),

      section("زمان مطالعه به تفکیک درس", subjectTableForReport(ds.bySubject)),

      completed.length
        ? section("فعالیت‌های انجام‌شده", taskLines(completed))
        : section(
            "فعالیت‌های انجام‌شده",
            el("p", { class: "text-muted text-sm", text: "هیچ فعالیتی در این روز تکمیل نشد." })
          ),

      notDone.length ? section("فعالیت‌های انجام‌نشده", taskLines(notDone)) : null,

      ds.skipped.length
        ? section(
            "دلایل انجام‌نشدن فعالیت‌ها",
            el(
              "div",
              {},
              S.countSkipReasons(ds.skipped).map(function (r) {
                return el("div", { class: "report-task-line" }, [
                  el("span", { class: "report-task-line__body", text: r.label }),
                  el("span", {
                    class: "report-task-line__num",
                    text: util.n(r.count) + " فعالیت"
                  })
                ]);
              })
            )
          )
        : null,

      ds.note
        ? section(
            "یادداشت دانش‌آموز",
            el("p", { class: "text-sm", style: { "white-space": "pre-wrap" }, text: ds.note })
          )
        : null,

      opts.includeConsultant !== false && ds.consultantNote
        ? section(
            "یادداشت مشاور برای این روز",
            el("p", {
              class: "text-sm",
              style: { "white-space": "pre-wrap" },
              text: ds.consultantNote
            })
          )
        : null,

      reportFoot(state)
    ]);
  };

  R.buildWeekly = function (weekId, options) {
    var opts = options || {};
    var state = HDML.store.get();
    var ws = S.weekStats(weekId);
    if (!ws) return UI.empty({ title: "این هفته پیدا نشد" });
    var p = state.consultant.student;

    var dailyTable = el("table", { class: "report-table" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", { text: "روز" }),
          el("th", { text: "تاریخ" }),
          el("th", { text: "برنامه" }),
          el("th", { text: "واقعی" }),
          el("th", { text: "تحقق" }),
          el("th", { text: "فعالیت" }),
          el("th", { text: "تست" })
        ])
      ]),
      el(
        "tbody",
        {},
        ws.days.map(function (d) {
          return el("tr", {}, [
            el("td", { text: d.dayName }),
            el("td", { text: D.format(d.date, "short") }),
            el("td", { text: util.fmtHM(d.plannedMinutes) }),
            el("td", { text: util.fmtHM(d.actualMinutes) }),
            el("td", {
              text:
                d.studyAchievementRate === null ? "—" : util.fmtPct(d.studyAchievementRate)
            }),
            el("td", {
              text: util.n(d.completedTasks) + " / " + util.n(d.totalTasks)
            }),
            el("td", {
              text:
                d.targetQuestions || d.completedQuestions
                  ? util.n(d.completedQuestions) + " / " + util.n(d.targetQuestions)
                  : "—"
            })
          ]);
        })
      ),
      el("tfoot", {}, [
        el("tr", {}, [
          el("td", { text: "مجموع" }),
          el("td", { text: "—" }),
          el("td", { text: util.fmtHM(ws.plannedMinutes) }),
          el("td", { text: util.fmtHM(ws.actualMinutes) }),
          el("td", {
            text:
              ws.studyAchievementRate === null ? "—" : util.fmtPct(ws.studyAchievementRate)
          }),
          el("td", {
            text: util.n(ws.completedTasks) + " / " + util.n(ws.totalTasks)
          }),
          el("td", {
            text: util.n(ws.completedQuestions) + " / " + util.n(ws.targetQuestions)
          })
        ])
      ])
    ]);

    var examSection = ws.exams.length
      ? section(
          "آزمون‌های این هفته",
          el(
            "div",
            {},
            ws.exams.map(function (es) {
              return el("div", { style: { "margin-bottom": "14px" } }, [
                el("div", { class: "report-task-line" }, [
                  el("span", { class: "report-task-line__body" }, [
                    el("strong", { text: es.name }),
                    el("span", { class: "text-muted", text: " — " + D.format(es.date, "long") })
                  ]),
                  el("span", {
                    class: "report-task-line__num",
                    text:
                      (es.overallPercentage === null
                        ? "بدون نتیجه"
                        : "درصد کل " + util.fmtPct(es.overallPercentage)) +
                      (es.rank ? " · رتبه " + util.n(es.rank) : "")
                  })
                ]),
                es.hasResult
                  ? el("table", { class: "report-table" }, [
                      el("thead", {}, [
                        el("tr", {}, [
                          el("th", { text: "درس" }),
                          el("th", { text: "درست" }),
                          el("th", { text: "غلط" }),
                          el("th", { text: "نزده" }),
                          el("th", { text: es.scoreMode === "score20" ? "نمره" : "درصد" })
                        ])
                      ]),
                      el(
                        "tbody",
                        {},
                        es.subjectRows.map(function (r) {
                          return el("tr", {}, [
                            el("td", { text: r.name }),
                            el("td", { text: r.totalQuestions ? util.n(r.correct) : "—" }),
                            el("td", { text: r.totalQuestions ? util.n(r.wrong) : "—" }),
                            el("td", { text: r.totalQuestions ? util.n(r.unanswered) : "—" }),
                            el("td", {
                              text: r.hasData
                                ? es.scoreMode === "score20"
                                  ? util.n(r.score)
                                  : util.fmtPct(r.percentage)
                                : "—"
                            })
                          ]);
                        })
                      )
                    ])
                  : null,
                es.analysis && es.analysis.review
                  ? el("p", {
                      class: "text-sm",
                      text: "مباحث نیازمند دوره: " + es.analysis.review
                    })
                  : null
              ]);
            })
          )
        )
      : null;

    var reflection = ws.reflection || {};
    var hasReflection =
      reflection.wentWell || reflection.difficult || reflection.improve;

    return wrapDoc([
      masthead(
        "گزارش عملکرد هفتگی",
        ws.week.title + " — " + D.formatRange(ws.week.startDate, ws.week.endDate)
      ),
      identityBar(state, [
        { label: "هدف", value: p.goal || "—" },
        { label: "بازه", value: D.formatRange(ws.week.startDate, ws.week.endDate) }
      ]),

      section(
        "شاخص‌های کلیدی هفته",
        kpiGrid([
          {
            label: "ساعت برنامه‌ریزی‌شده",
            value: util.fmtHM(ws.plannedMinutes),
            sub: util.fmtDur(ws.plannedMinutes)
          },
          {
            label: "ساعت واقعی مطالعه",
            value: util.fmtHM(ws.actualMinutes),
            sub: ws.hasEstimatedTime
              ? util.fmtHM(ws.estimatedMinutes) + " برآوردی"
              : "کاملاً ثبت‌شده"
          },
          {
            label: "تحقق مطالعه",
            value:
              ws.studyAchievementRate === null ? "—" : util.fmtPct(ws.studyAchievementRate),
            sub: "واقعی ÷ برنامه"
          },
          {
            label: "فعالیت‌ها",
            value: util.n(ws.completedTasks) + " / " + util.n(ws.totalTasks),
            sub:
              ws.taskCompletionRate === null
                ? "—"
                : util.fmtPct(ws.taskCompletionRate) + " انجام‌شده"
          },
          {
            label: "تست",
            value: util.n(ws.completedQuestions) + " / " + util.n(ws.targetQuestions),
            sub:
              ws.questionCompletionRate === null
                ? "بدون هدف تست"
                : util.fmtPct(ws.questionCompletionRate) + " تحقق"
          },
          {
            label: "درصد پاسخ صحیح",
            value: ws.accuracy === null ? "—" : util.fmtPct(ws.accuracy),
            sub:
              util.n(ws.correct) +
              " درست · " +
              util.n(ws.wrong) +
              " غلط · " +
              util.n(ws.unanswered) +
              " نزده"
          },
          {
            label: "میانگین روزانه",
            value: util.fmtHM(ws.averageDailyMinutes),
            sub: util.n(ws.elapsedDays) + " روز سپری‌شده"
          },
          {
            label: "بهترین / ضعیف‌ترین روز",
            value:
              (ws.bestDay ? ws.bestDay.dayName : "—") +
              " / " +
              (ws.weakestDay ? ws.weakestDay.dayName : "—"),
            sub: ws.bestDay
              ? util.fmtHM(ws.bestDay.actualMinutes) +
                " در برابر " +
                util.fmtHM(ws.weakestDay.actualMinutes)
              : "بدون داده"
          }
        ])
      ),

      section("عملکرد روزانه", dailyTable),

      section("زمان مطالعه به تفکیک درس", subjectTableForReport(ws.bySubject)),

      section("برنامه در برابر عملکرد واقعی", C.plannedVsActual(S.trend({ weekId: weekId }))),

      section("پیشرفت دروس", C.subjectRadar(S.subjectRadar(weekId))),

      section("روند ساعت مطالعه", C.studyTrend(S.trend({ limit: 28 })), { break: true }),

      examSection,

      ws.skipped.length
        ? section(
            "فعالیت‌های انجام‌نشده و دلایل آن",
            el("div", {}, [
              el(
                "div",
                {},
                ws.skipReasons.map(function (r) {
                  return el("div", { class: "report-task-line" }, [
                    el("span", { class: "report-task-line__body", text: r.label }),
                    el("span", {
                      class: "report-task-line__num",
                      text: util.n(r.count) + " فعالیت"
                    })
                  ]);
                })
              ),
              taskLines(ws.skipped)
            ])
          )
        : null,

      hasReflection
        ? section(
            "جمع‌بندی دانش‌آموز",
            el("div", { class: "report-notes-grid" }, [
              reflection.wentWell
                ? el("div", {}, [
                    el("strong", { text: "چه چیزی خوب پیش رفت؟" }),
                    el("p", { class: "text-sm", text: reflection.wentWell })
                  ])
                : null,
              reflection.difficult
                ? el("div", {}, [
                    el("strong", { text: "چه چیزی سخت بود؟" }),
                    el("p", { class: "text-sm", text: reflection.difficult })
                  ])
                : null,
              reflection.improve
                ? el("div", {}, [
                    el("strong", { text: "برای هفته‌ی بعد" }),
                    el("p", { class: "text-sm", text: reflection.improve })
                  ])
                : null
            ])
          )
        : null,

      opts.includeConsultant !== false && ws.week.consultantNote
        ? section(
            "یادداشت مشاور برای این هفته",
            el("p", {
              class: "text-sm",
              style: { "white-space": "pre-wrap" },
              text: ws.week.consultantNote
            })
          )
        : null,

      opts.includeConsultant !== false && ws.consultantFeedback && ws.consultantFeedback.text
        ? section(
            "بازخورد مشاور",
            el("p", {
              class: "text-sm",
              style: { "white-space": "pre-wrap" },
              text: ws.consultantFeedback.text
            })
          )
        : null,

      reportFoot(state)
    ]);
  };

  R.print = function () {
    /* Small delay so charts finish laying out before the print dialog. */
    setTimeout(function () {
      global.print();
    }, 60);
  };

  /**
   * Standalone HTML report: the report node plus the app's own stylesheets
   * inlined, so the file opens correctly anywhere with no assets.
   */
  R.exportHtml = function (reportNode, title) {
    if (!reportNode) {
      UI.toast("گزارشی برای خروجی گرفتن وجود ندارد.", "danger");
      return;
    }
    var css = collectCss();
    var html =
      "<!doctype html>\n" +
      '<html lang="fa" dir="rtl">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      "<title>" +
      util.escapeHtml(title) +
      "</title>\n<style>\n" +
      css +
      "\nbody{background:var(--color-background);padding:24px;}\n" +
      ".report-doc{margin:0 auto;}\n</style>\n</head>\n<body>\n" +
      reportNode.outerHTML +
      "\n</body>\n</html>";

    HDML.transfer.downloadFile(
      html,
      sanitizeFilename(title) + ".html",
      "text/html;charset=utf-8"
    );
    UI.toast("گزارش HTML ذخیره شد.", "success");
  };

  R.exportJson = function (kind, id) {
    var state = HDML.store.get();
    var payload;
    if (kind === "daily") {
      var day = Q.dayByDate(id);
      if (!day) return;
      var ds = S.dayStats(day.id);
      payload = {
        kind: "daily-report",
        generatedAt: D.now(),
        student: state.consultant.student,
        date: ds.date,
        dateJalali: D.isoToJalaliInput(ds.date),
        summary: pickAggregate(ds),
        bySubject: ds.bySubject.map(pickSubject),
        tasks: ds.taskStats.map(pickTask),
        note: ds.note
      };
    } else {
      var ws = S.weekStats(id);
      if (!ws) return;
      payload = {
        kind: "weekly-report",
        generatedAt: D.now(),
        student: state.consultant.student,
        week: {
          title: ws.week.title,
          startDate: ws.week.startDate,
          endDate: ws.week.endDate
        },
        summary: pickAggregate(ws),
        days: ws.days.map(function (d) {
          return Object.assign({ date: d.date, dayName: d.dayName }, pickAggregate(d));
        }),
        bySubject: ws.bySubject.map(pickSubject),
        skipReasons: ws.skipReasons,
        exams: ws.exams.map(function (e) {
          return {
            name: e.name,
            date: e.date,
            overallPercentage: e.overallPercentage,
            rank: e.rank,
            subjects: e.subjectRows.map(function (r) {
              return { name: r.name, percentage: r.percentage };
            })
          };
        }),
        reflection: ws.reflection
      };
    }

    HDML.transfer.downloadFile(
      JSON.stringify(payload, null, 2),
      sanitizeFilename(
        kind === "daily" ? "daily-report-" + id : "weekly-report-" + ws.week.title
      ) + ".json",
      "application/json"
    );
    UI.toast("خروجی JSON ذخیره شد.", "success");
  };

  function pickAggregate(agg) {
    return {
      plannedMinutes: agg.plannedMinutes,
      actualMinutes: agg.actualMinutes,
      estimatedMinutes: agg.estimatedMinutes,
      studyAchievementRate: agg.studyAchievementRate,
      totalTasks: agg.totalTasks,
      completedTasks: agg.completedTasks,
      skippedTasks: agg.skippedTasks,
      taskCompletionRate: agg.taskCompletionRate,
      targetQuestions: agg.targetQuestions,
      completedQuestions: agg.completedQuestions,
      correct: agg.correct,
      wrong: agg.wrong,
      unanswered: agg.unanswered,
      questionCompletionRate: agg.questionCompletionRate,
      accuracy: agg.accuracy,
      overallScore: agg.overallScore
    };
  }

  function pickSubject(r) {
    return {
      name: r.name,
      plannedMinutes: r.plannedMinutes,
      actualMinutes: r.actualMinutes,
      deltaMinutes: r.deltaMinutes,
      studyAchievementRate: r.studyAchievementRate,
      completedQuestions: r.completedQuestions,
      targetQuestions: r.targetQuestions
    };
  }

  function pickTask(ts) {
    return {
      title: ts.task.title,
      subject: Q.subjectName(ts.task.subjectId),
      type: ts.task.type,
      status: ts.status,
      plannedMinutes: ts.plannedMinutes,
      actualMinutes: ts.actualMinutes,
      timeSource: ts.timeSource,
      targetQuestions: ts.targetQuestions,
      questionsCompleted: ts.questionsCompleted,
      correct: ts.correct,
      wrong: ts.wrong,
      unanswered: ts.unanswered,
      accuracy: ts.accuracy,
      skipReason: ts.skipReason,
      note: ts.note
    };
  }

  /** Collects every stylesheet rule in the document (they are all local). */
  function collectCss() {
    var out = [];
    var sheets = global.document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules;
        for (var j = 0; j < rules.length; j++) out.push(rules[j].cssText);
      } catch (err) {
        /* Cross-origin sheets cannot be read; there are none in this app. */
      }
    }
    return out.join("\n");
  }

  R.collectCss = collectCss;

  function sanitizeFilename(name) {
    return String(name)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }

  R.sanitizeFilename = sanitizeFilename;
})(typeof window !== "undefined" ? window : globalThis);
