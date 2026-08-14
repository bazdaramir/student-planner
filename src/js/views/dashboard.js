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
  var C = HDML.charts;
  var el = UI.el;

  HDML.views = HDML.views || {};

  HDML.views.dashboard = function (ctx) {
    var state = HDML.store.get();
    var week = Q.currentWeek(state);
    var profile = state.consultant.student;
    var container = el("div", {});

    if (!week) {
      return V.noPlan(ctx);
    }

    var ws = S.weekStats(week.id);
    var todayIso = D.today();
    var todayStats = S.dayStatsByDate(todayIso);

    container.appendChild(
      el("div", { class: "hero" }, [
        el("div", { class: "hero__eyebrow", text: "سامانه‌ی برنامه‌ریزی و گزارش عملکرد" }),
        el("h1", { class: "hero__title", text: Q.studentFullName(state) }),
        el("div", {
          class: "hero__sub",
          text:
            [profile.grade, util.trackLabel(profile.track)]
              .filter(Boolean)
              .join(" — ") +
            (profile.consultantName ? " · مشاور: " + profile.consultantName : "") +
            " · " +
            D.format(todayIso, "full")
        }),
        profile.goal
          ? el("div", {
              class: "hero__sub",
              style: { "margin-top": "6px" },
              text: "هدف: " + profile.goal
            })
          : null,
        el("div", { class: "hero__stats" }, [
          heroStat(
            "مطالعه‌ی امروز",
            todayStats ? util.fmtDur(todayStats.actualMinutes) : "—",
            todayStats
              ? "از " + util.fmtDur(todayStats.plannedMinutes)
              : "امروز در این هفته نیست",
            todayStats ? todayStats.studyAchievementRate : null
          ),
          heroStat(
            "مطالعه‌ی هفته",
            util.fmtDur(ws.actualMinutes),
            "از " + util.fmtDur(ws.plannedMinutes),
            ws.studyAchievementRate
          ),
          heroStat(
            "فعالیت‌های هفته",
            util.n(ws.completedTasks) + " / " + util.n(ws.totalTasks),
            ws.taskCompletionRate === null
              ? "بدون فعالیت"
              : util.fmtPct(ws.taskCompletionRate) + " انجام‌شده",
            ws.taskCompletionRate
          ),
          heroStat(
            "تست هفته",
            ws.targetQuestions || ws.completedQuestions
              ? util.n(ws.completedQuestions) + " / " + util.n(ws.targetQuestions)
              : "—",
            ws.accuracy !== null ? "درصد صحیح: " + util.fmtPct(ws.accuracy) : "بدون داده",
            ws.questionCompletionRate
          )
        ])
      ])
    );

    var banner = V.runningBanner();
    if (banner) container.appendChild(banner);

    var todaySection = el("div", { class: "view-section" });
    todaySection.appendChild(
      UI.sectionHead(
        "فعالیت‌های امروز",
        todayStats ? D.format(todayIso, "full") : null,
        UI.button("مشاهده‌ی کامل", {
          icon: "today",
          size: "sm",
          onClick: function () {
            ctx.navigate("today");
          }
        })
      )
    );

    if (!todayStats) {
      todaySection.appendChild(
        UI.empty({
          icon: "today",
          title: "امروز در بازه‌ی هفته‌ی انتخاب‌شده نیست",
          text:
            "هفته‌ی جاری از " +
            D.format(week.startDate, "long") +
            " تا " +
            D.format(week.endDate, "long") +
            " است.",
          action: UI.button("رفتن به برنامه‌ی هفته", {
            variant: "primary",
            onClick: function () {
              ctx.navigate("week");
            }
          })
        })
      );
    } else if (!todayStats.taskStats.length) {
      todaySection.appendChild(
        UI.empty({
          icon: "inbox",
          title: "برای امروز فعالیتی تعریف نشده است",
          text: "روز دیگری را از برنامه‌ی هفتگی انتخاب کنید."
        })
      );
    } else {
      /* Unfinished work first; show at most five, the rest live in Today. */
      var pending = todayStats.taskStats.filter(function (t) {
        return !t.isCompleted && !t.isSkipped;
      });
      var shown = (pending.length ? pending : todayStats.taskStats).slice(0, 5);

      todaySection.appendChild(
        el(
          "div",
          { class: "task-list" },
          shown.map(function (ts) {
            return T.card(ts, { compact: true });
          })
        )
      );

      var remaining = (pending.length ? pending : todayStats.taskStats).length - shown.length;
      if (remaining > 0) {
        todaySection.appendChild(
          el("div", { class: "text-center", style: { "margin-top": "12px" } }, [
            UI.button(util.n(remaining) + " فعالیت دیگر", {
              variant: "ghost",
              onClick: function () {
                ctx.navigate("today");
              }
            })
          ])
        );
      }
      if (!pending.length) {
        todaySection.appendChild(
          el(
            "div",
            { style: { "margin-top": "12px" } },
            UI.notice("همه‌ی فعالیت‌های امروز تعیین‌تکلیف شده‌اند.", "success")
          )
        );
      }
    }
    container.appendChild(todaySection);

    container.appendChild(
      el("div", { class: "view-section grid grid--2" }, [
        UI.card({
          title: "برنامه در برابر عملکرد واقعی",
          icon: "progress",
          hint: week.title,
          body: C.plannedVsActual(S.trend({ weekId: week.id }), { height: 230 })
        }),
        UI.card({
          title: "پیشرفت دروس",
          icon: "target",
          hint: "زمان واقعی / زمان برنامه",
          body: C.subjectRadar(S.subjectRadar(week.id), { size: 300 })
        })
      ])
    );

    var exams = S.allExamStats();
    var withResult = exams.filter(function (e) {
      return e.hasResult;
    });
    var lastExam = withResult.length ? withResult[withResult.length - 1] : null;
    var upcoming = exams.filter(function (e) {
      return e.isUpcoming;
    })[0];

    container.appendChild(
      el("div", { class: "view-section grid grid--2" }, [
        UI.card({
          title: "آخرین آزمون",
          icon: "exam",
          actions: UI.button("همه‌ی آزمون‌ها", {
            size: "sm",
            variant: "ghost",
            onClick: function () {
              ctx.navigate("exams");
            }
          }),
          body: lastExam
            ? examSummary(lastExam, ctx)
            : upcoming
            ? el("div", { class: "stack" }, [
                UI.notice(
                  "آزمون پیش‌رو: <strong>" +
                    util.escapeHtml(upcoming.name) +
                    "</strong> در تاریخ " +
                    util.escapeHtml(D.format(upcoming.date, "long")),
                  "info"
                ),
                UI.button("ثبت نتیجه", {
                  variant: "primary",
                  icon: "plus",
                  onClick: function () {
                    ctx.navigate("exams");
                  }
                })
              ])
            : UI.empty({
                icon: "exam",
                title: "هنوز آزمونی ثبت نشده است",
                text: "آزمون‌ها را در بخش آزمون‌ها اضافه و نتیجه‌شان را ثبت کنید.",
                action: UI.button("رفتن به آزمون‌ها", {
                  variant: "primary",
                  onClick: function () {
                    ctx.navigate("exams");
                  }
                })
              })
        }),
        UI.card({
          title: "آخرین یادداشت‌ها",
          icon: "note",
          body: latestNotes(state, ws)
        })
      ])
    );

    var trendSeries = S.trend({ limit: 28 });
    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "روند ساعت مطالعه",
          icon: "progress",
          hint: "تا ۲۸ روز اخیر — با اضافه‌شدن هفته‌های جدید ادامه پیدا می‌کند",
          actions: UI.button("جزئیات بیشتر", {
            size: "sm",
            variant: "ghost",
            onClick: function () {
              ctx.navigate("progress");
            }
          }),
          body: C.studyTrend(trendSeries)
        })
      ])
    );

    return container;
  };

  function heroStat(label, value, foot, rate) {
    return el("div", { class: "hero__stat" }, [
      el("div", { class: "hero__stat-label", text: label }),
      el("div", { class: "hero__stat-value", text: value }),
      UI.meter(rate, { label: label }),
      el("div", {
        class: "hero__stat-label",
        style: { "margin-top": "4px" },
        text: foot
      })
    ]);
  }

  function examSummary(es, ctx) {
    return el("div", { class: "stack" }, [
      el("div", { class: "exam-card__head" }, [
        el("div", {}, [
          el("div", { class: "exam-card__name", text: es.name }),
          el("div", { class: "exam-card__date", text: D.format(es.date, "long") })
        ]),
        el("div", { class: "exam-card__score" }, [
          el("div", {
            class: "exam-card__score-value",
            text: es.overallPercentage === null ? "—" : util.fmtPct(es.overallPercentage)
          }),
          el("div", { class: "exam-card__score-label", text: "درصد کل" })
        ])
      ]),
      es.rank
        ? UI.kv("رتبه", util.n(es.rank) + (es.totalParticipants ? " از " + util.n(es.totalParticipants) : ""))
        : null,
      el(
        "div",
        { class: "subject-score-grid" },
        es.subjectRows
          .filter(function (r) {
            return r.hasData;
          })
          .slice(0, 6)
          .map(function (r) {
            return el("div", { class: "subject-score" }, [
              el("div", { class: "subject-score__name", text: r.name }),
              el("div", {
                class: "subject-score__value",
                style: { color: util.toneColor(util.rateTone(r.percentage)) },
                text: util.fmtPct(r.percentage)
              })
            ]);
          })
      ),
      UI.button("مشاهده‌ی جزئیات آزمون", {
        size: "sm",
        variant: "ghost",
        onClick: function () {
          ctx.navigate("exams", { examId: es.examId });
        }
      })
    ]);
  }

  function latestNotes(state, ws) {
    var items = [];

    if (ws.week.consultantNote) {
      items.push(UI.noteBlock("یادداشت مشاور — هفته", ws.week.consultantNote, "consultant"));
    }
    if (ws.consultantFeedback && ws.consultantFeedback.text) {
      items.push(UI.noteBlock("بازخورد مشاور", ws.consultantFeedback.text, "consultant"));
    }

    var dayNotes = ws.days
      .filter(function (d) {
        return d.note;
      })
      .slice(-3)
      .reverse();

    dayNotes.forEach(function (d) {
      items.push(
        UI.noteBlock(
          "یادداشت " + d.dayName + " " + D.format(d.date, "medium"),
          util.truncate(d.note, 220),
          "student"
        )
      );
    });

    if (ws.reflection && ws.reflection.improve) {
      items.push(
        UI.noteBlock("برای هفته‌ی بعد", ws.reflection.improve, "student")
      );
    }

    if (!items.length) {
      return UI.empty({
        icon: "note",
        title: "هنوز یادداشتی نوشته نشده است",
        text: "در پایان هر روز، تجربه‌ی آن روز را در بخش «برنامه امروز» یادداشت کنید."
      });
    }

    return el("div", { class: "stack" }, items);
  }
})(typeof window !== "undefined" ? window : globalThis);
