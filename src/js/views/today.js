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

  HDML.views.today = function (ctx) {
    var state = HDML.store.get();
    var week = Q.currentWeek(state);

    if (!week) return V.noPlan(ctx);

    var days = Q.daysOfWeek(week.id);
    var todayIso = D.today();
    var selected = state.ui.selectedDate;
    if (!selected || !days.some(function (d) { return d.date === selected; })) {
      selected = days.some(function (d) { return d.date === todayIso; })
        ? todayIso
        : days.length
        ? days[0].date
        : null;
    }

    var day = days.filter(function (d) {
      return d.date === selected;
    })[0];
    if (!day) return V.noPlan(ctx);

    var ds = S.dayStats(day.id);
    var isToday = day.date === todayIso;
    var box = el("div", {});

    box.appendChild(
      el("div", { class: "greet" }, [
        el("div", {
          class: "greet__hello",
          text: isToday
            ? "سلام " + (state.consultant.student.firstName || "") + " 👋"
            : "برنامه‌ی این روز"
        }),
        el("div", {
          class: "greet__big",
          text: isToday ? "امروز" : D.relativeLabel(day.date, todayIso)
        }),
        el("div", { class: "greet__date", text: D.format(day.date, "full") })
      ])
    );

    box.appendChild(
      el("div", { class: "today-box" }, [
        el("div", { class: "today-box__row" }, [
          el("div", { class: "today-box__item" }, [
            el("div", { class: "today-box__q", text: "برنامه امروز" }),
            el("div", { class: "today-box__a", text: util.fmtDur(ds.plannedMinutes) })
          ]),
          el("div", { class: "today-box__item" }, [
            el("div", { class: "today-box__q", text: "انجام شده" }),
            el("div", { class: "today-box__a", text: util.fmtDur(ds.actualMinutes) })
          ])
        ]),
        UI.meter(ds.studyAchievementRate, { label: "پیشرفت امروز", large: true }),
        el("div", {
          class: "today-box__note",
          text:
            ds.totalTasks === 0
              ? "برای این روز کاری ثبت نشده."
              : util.n(ds.completedTasks) +
                " کار از " +
                util.n(ds.totalTasks) +
                " کار انجام شده" +
                (ds.completedQuestions ? " · " + util.n(ds.completedQuestions) + " تست زدی" : "")
        })
      ])
    );

    box.appendChild(
      el("div", { class: "no-print", style: { "margin-bottom": "20px" } }, [
        V.dayStrip(week.id, selected, function (date) {
          A.setUi({ selectedDate: date });
        })
      ])
    );

    var banner = V.runningBanner();
    if (banner) box.appendChild(banner);

    if (ds.consultantNote) {
      box.appendChild(
        el("div", { style: { "margin-bottom": "20px" } },
          UI.noteBlock("پیام مشاور", ds.consultantNote, "consultant"))
      );
    }

    var all = ds.taskStats;

    box.appendChild(
      el("div", { class: "section-title" }, [
        el("span", { text: "کارهای امروز" }),
        el("span", { class: "section-title__count", text: util.n(all.length) + " کار" })
      ])
    );

    if (!all.length) {
      box.appendChild(
        UI.empty({
          icon: "inbox",
          title: "برای این روز کاری نداری",
          text: "روز دیگری را انتخاب کن، یا برنامه‌ی جدید را از مشاورت بگیر."
        })
      );
      return box;
    }

    box.appendChild(
      el("div", { class: "no-print", style: { "margin-bottom": "16px" } }, [
        T.filterBar(all, function () {
          ctx.rerender();
        })
      ])
    );

    var filtered = T.applyFilter(all);

    if (!filtered.length) {
      box.appendChild(
        UI.empty({ icon: "check", title: "چیزی برای نمایش نیست", text: "فیلتر را عوض کن." })
      );
    } else {
      /* Unfinished first, finished stays visible underneath. */
      var order = { in_progress: 0, pending: 1, completed: 2, skipped: 3 };
      var sorted = filtered.slice().sort(function (a, b) {
        var oa = order[a.status];
        var ob = order[b.status];
        if (oa !== ob) return oa - ob;
        return (a.task.order || 0) - (b.task.order || 0);
      });

      box.appendChild(
        el(
          "div",
          {},
          sorted.map(function (ts) {
            return T.card(ts);
          })
        )
      );
    }

    if (ds.totalTasks && ds.completedTasks === ds.totalTasks) {
      box.appendChild(
        el("div", { style: { "margin-top": "20px" } },
          UI.notice("🎉 همه‌ی کارهای امروز را انجام دادی. عالی بود!", "success"))
      );
    }

    box.appendChild(el("div", { class: "section-title", text: "یادداشت امروز" }));
    box.appendChild(
      el("div", { class: "simple-card" }, [
        V.noteEditor({
          label: "امروز چطور بود؟ (اختیاری)",
          placeholder: "مثلاً: صبح تمرکز خوبی داشتم، عصر خسته بودم.",
          value: ds.note,
          rows: 3,
          hint: "این یادداشت در گزارش تو برای مشاور می‌آید.",
          onSave: function (value) {
            A.setDailyNote(day.id, value);
          }
        })
      ])
    );

    box.appendChild(
      el("div", { class: "no-print", style: { "margin-top": "20px" } }, [
        UI.button("📤 گزارش امروز را بساز", {
          size: "lg",
          block: true,
          onClick: function () {
            ctx.navigate("reports", { reportType: "daily", date: day.date });
          }
        })
      ])
    );

    return box;
  };
})(typeof window !== "undefined" ? window : globalThis);
