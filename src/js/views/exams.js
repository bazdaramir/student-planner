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
  var E = (HDML.examUI = {});

  HDML.views.exams = function (ctx) {
    var exams = S.allExamStats();
    var box = el("div", {});

    box.appendChild(
      el("div", { class: "greet" }, [
        el("div", { class: "greet__hello", text: "آزمون‌های من" }),
        el("div", { class: "greet__date", text: "نتیجه‌ی آزمون‌هایت را اینجا ثبت کن" })
      ])
    );

    box.appendChild(
      el("div", { class: "no-print", style: { "margin-bottom": "22px" } }, [
        UI.button("➕ ثبت آزمون جدید", {
          variant: "primary",
          size: "lg",
          block: true,
          onClick: function () {
            E.openExamForm(null);
          }
        })
      ])
    );

    if (!exams.length) {
      box.appendChild(
        UI.empty({
          icon: "exam",
          title: "هنوز آزمونی ثبت نکردی",
          text: "بعد از هر آزمون، نتیجه‌اش را اینجا وارد کن تا پیشرفتت را ببینی."
        })
      );
      return box;
    }

    var upcoming = exams.filter(function (e) {
      return e.isUpcoming;
    });
    var done = exams
      .filter(function (e) {
        return !e.isUpcoming;
      })
      .reverse();

    if (upcoming.length) {
      box.appendChild(el("div", { class: "section-title", text: "آزمون‌های پیش‌رو" }));
      upcoming.forEach(function (es) {
        box.appendChild(
          el("div", { class: "simple-card" }, [
            el("div", { class: "simple-card__title", text: es.name }),
            el("div", {
              class: "simple-card__sub",
              text: D.format(es.date, "full") + " — " + D.relativeLabel(es.date)
            }),
            es.consultantNote
              ? el("div", { style: { "margin-top": "12px" } },
                  UI.noteBlock("پیام مشاور", es.consultantNote, "consultant"))
              : null,
            el("div", { style: { "margin-top": "14px" } }, [
              UI.button("ثبت نتیجه", {
                variant: "primary",
                block: true,
                onClick: function () {
                  E.openExamForm(es.examId);
                }
              })
            ])
          ])
        );
      });
    }

    if (done.length) {
      box.appendChild(el("div", { class: "section-title", text: "آزمون‌های گذشته" }));
      done.forEach(function (es) {
        box.appendChild(examCard(es, ctx));
      });
    }

    /* One chart, only once there is something to compare. */
    var trend = S.examTrend();
    if (trend.length >= 2) {
      box.appendChild(el("div", { class: "section-title", text: "روند درصد کل" }));
      box.appendChild(el("div", { class: "simple-card" }, C.examTrend(trend)));
    }

    return box;
  };

  function examCard(es, ctx) {
    var scores = [];
    if (es.taraz) {
      scores.push(scoreBlock(util.n(es.taraz), "تراز"));
    }
    if (es.overallPercentage !== null) {
      scores.push(scoreBlock(util.fmtPct(es.overallPercentage), "درصد کل"));
    }
    if (es.rank) {
      scores.push(scoreBlock(util.n(es.rank), "رتبه"));
    }

    var withData = es.subjectRows.filter(function (r) {
      return r.hasData;
    });

    var details = el("div", { class: "more-panel", hidden: true });
    var detailsBtn = el(
      "button",
      {
        type: "button",
        class: "more-toggle",
        "aria-expanded": "false",
        onclick: function () {
          var opening = details.hidden;
          details.hidden = !opening;
          detailsBtn.setAttribute("aria-expanded", opening ? "true" : "false");
          if (opening && !details.childNodes.length) {
            details.appendChild(examDetails(es));
          }
        }
      },
      [UI.icon("chevronDown"), el("span", { text: "جزئیات بیشتر" })]
    );

    return el("div", { class: "exam-simple" }, [
      el("div", { class: "exam-simple__top" }, [
        el("div", { style: { "min-width": "0" } }, [
          el("div", { class: "exam-simple__name", text: es.name }),
          el("div", { class: "exam-simple__date", text: D.format(es.date, "long") })
        ]),
        scores.length ? el("div", { class: "exam-simple__scores" }, scores) : null
      ]),

      withData.length
        ? el(
            "div",
            { class: "exam-chips" },
            withData.map(function (r) {
              return el("span", { class: "exam-chip" }, [
                el("span", { text: r.name }),
                el("strong", {
                  style: { color: util.toneColor(util.rateTone(r.percentage)) },
                  text:
                    es.scoreMode === "score20"
                      ? util.n(r.score)
                      : util.fmtPct(r.percentage)
                })
              ]);
            })
          )
        : UI.notice("نتیجه‌ی این آزمون هنوز ثبت نشده.", "warning"),

      el("div", { class: "mini-actions no-print" }, [
        el("button", {
          type: "button",
          class: "mini-link",
          text: "✏️ ویرایش",
          onclick: function () {
            E.openExamForm(es.examId);
          }
        }),
        el("button", {
          type: "button",
          class: "mini-link",
          text: "🗑 حذف",
          onclick: function () {
            UI.confirm({
              title: "حذف آزمون",
              message: "این آزمون و نتیجه‌اش حذف می‌شود. مطمئنی؟",
              danger: true,
              confirmLabel: "حذف"
            }).then(function (ok) {
              if (ok) {
                A.deleteExam(es.examId);
                UI.toast("حذف شد.");
              }
            });
          }
        })
      ]),

      withData.length ? detailsBtn : null,
      withData.length ? details : null
    ]);
  }

  function scoreBlock(value, label) {
    return el("div", {}, [
      el("div", { class: "exam-simple__score-v", text: value }),
      el("div", { class: "exam-simple__score-l", text: label })
    ]);
  }

  function examDetails(es) {
    var a = es.analysis || {};
    var hasCounts = es.subjectRows.some(function (r) {
      return r.totalQuestions > 0;
    });

    return el("div", { class: "stack" }, [
      hasCounts
        ? el("div", { class: "table-wrap" }, [
            el("table", { class: "data-table" }, [
              el("thead", {}, [
                el("tr", {}, [
                  el("th", { text: "درس" }),
                  el("th", { class: "num-cell", text: "درست" }),
                  el("th", { class: "num-cell", text: "غلط" }),
                  el("th", { class: "num-cell", text: "نزده" }),
                  el("th", { class: "num-cell", text: "درصد" })
                ])
              ]),
              el(
                "tbody",
                {},
                es.subjectRows.map(function (r) {
                  return el("tr", {}, [
                    el("td", { text: r.name }),
                    el("td", { class: "num-cell", text: r.totalQuestions ? util.n(r.correct) : "—" }),
                    el("td", { class: "num-cell", text: r.totalQuestions ? util.n(r.wrong) : "—" }),
                    el("td", { class: "num-cell", text: r.totalQuestions ? util.n(r.unanswered) : "—" }),
                    el("td", { class: "num-cell", text: r.hasData ? util.fmtPct(r.percentage) : "—" })
                  ]);
                })
              )
            ])
          ])
        : null,
      es.best ? UI.kv("بهترین درس", es.best.name + " (" + util.fmtPct(es.best.percentage) + ")") : null,
      es.worst ? UI.kv("ضعیف‌ترین درس", es.worst.name + " (" + util.fmtPct(es.worst.percentage) + ")") : null,
      a.good ? UI.noteBlock("چی خوب بود", a.good, "student") : null,
      a.bad ? UI.noteBlock("چی بد بود", a.bad, "student") : null,
      a.review ? UI.noteBlock("باید دوره کنم", a.review, "student") : null,
      es.consultantNote ? UI.noteBlock("پیام مشاور", es.consultantNote, "consultant") : null
    ]);
  }

  /**
   * One dialog does everything: define the exam and record its result.
   * Advanced fields (per-question counts, analysis) stay collapsed.
   */
  E.openExamForm = function (examId) {
    var state = HDML.store.get();
    var exam = examId ? state.consultant.exams[examId] : null;
    var es = examId ? S.examStats(examId, state) : null;
    var result = (es && es.result) || {};

    var subjects = Q.activeSubjects(state);
    if (!subjects.length) {
      UI.toast("اول باید حداقل یک درس داشته باشی. یک برنامه وارد کن.", "danger", 4500);
      return;
    }

    var chosen = exam
      ? (exam.subjectIds || []).slice()
      : subjects.map(function (s) {
          return s.id;
        });

    var basics = el("div", { class: "form-grid" }, [
      UI.field({
        label: "نام آزمون",
        name: "name",
        required: true,
        value: exam ? exam.name : "",
        placeholder: "مثلاً: آزمون قلم‌چی ۲۶ مرداد",
        full: true
      }),
      UI.field({
        label: "تاریخ",
        name: "date",
        value: exam ? D.isoToJalaliInput(exam.date) : D.isoToJalaliInput(D.today()),
        hint: "مثل ۱۴۰۵/۰۵/۲۶"
      }),
      UI.field({
        label: "تراز",
        name: "taraz",
        type: "number",
        min: 0,
        inputmode: "numeric",
        controlClass: "input--num",
        value: result.taraz == null ? "" : result.taraz
      }),
      UI.field({
        label: "رتبه",
        name: "rank",
        type: "number",
        min: 0,
        inputmode: "numeric",
        controlClass: "input--num",
        value: result.rank == null ? "" : result.rank
      })
    ]);

    var pctWrap = el("div", { class: "form-grid" });

    function pctFieldFor(s) {
      var row =
        es &&
        es.subjectRows.filter(function (r) {
          return r.subjectId === s.id;
        })[0];
      return UI.field({
        label: s.name,
        name: "p_" + s.id,
        type: "number",
        step: 0.1,
        inputmode: "decimal",
        controlClass: "input--num",
        value: row && row.hasData ? row.percentage : ""
      });
    }

    subjects.forEach(function (s) {
      if (chosen.indexOf(s.id) >= 0) pctWrap.appendChild(pctFieldFor(s));
    });

    var advanced = el("div", { class: "more-panel", hidden: true }, [
      el("p", {
        class: "field__hint",
        text: "اگر تعداد درست و غلط را وارد کنی، درصد خودش دقیق حساب می‌شود و درصد بالا نادیده گرفته می‌شود."
      }),
      countsTable(),
      UI.field({
        label: "چی خوب بود؟",
        name: "aGood",
        type: "textarea",
        rows: 2,
        full: true,
        value: (result.analysis && result.analysis.good) || ""
      }),
      UI.field({
        label: "چی بد بود؟",
        name: "aBad",
        type: "textarea",
        rows: 2,
        full: true,
        value: (result.analysis && result.analysis.bad) || ""
      }),
      UI.field({
        label: "چی را باید دوره کنم؟",
        name: "aReview",
        type: "textarea",
        rows: 2,
        full: true,
        value: (result.analysis && result.analysis.review) || ""
      })
    ]);

    function countsTable() {
      var wrap = el("div", { class: "stack stack--sm" });
      subjects.forEach(function (s) {
        if (chosen.indexOf(s.id) < 0) return;
        var row =
          es &&
          es.subjectRows.filter(function (r) {
            return r.subjectId === s.id;
          })[0];
        wrap.appendChild(
          el("div", {}, [
            el("div", { class: "field__label", text: s.name }),
            el("div", { class: "form-grid" }, [
              UI.field({
                label: "کل",
                name: "c_" + s.id + "_total",
                type: "number",
                min: 0,
                controlClass: "input--num",
                value: row && row.totalQuestions ? row.totalQuestions : ""
              }),
              UI.field({
                label: "درست",
                name: "c_" + s.id + "_correct",
                type: "number",
                min: 0,
                controlClass: "input--num",
                value: row && row.totalQuestions ? row.correct : ""
              }),
              UI.field({
                label: "غلط",
                name: "c_" + s.id + "_wrong",
                type: "number",
                min: 0,
                controlClass: "input--num",
                value: row && row.totalQuestions ? row.wrong : ""
              }),
              UI.field({
                label: "نزده",
                name: "c_" + s.id + "_blank",
                type: "number",
                min: 0,
                controlClass: "input--num",
                value: row && row.totalQuestions ? row.unanswered : ""
              })
            ])
          ])
        );
      });
      return wrap;
    }

    var moreBtn = el(
      "button",
      {
        type: "button",
        class: "more-toggle",
        "aria-expanded": "false",
        onclick: function () {
          var opening = advanced.hidden;
          advanced.hidden = !opening;
          moreBtn.setAttribute("aria-expanded", opening ? "true" : "false");
        }
      },
      [UI.icon("chevronDown"), el("span", { text: "جزئیات بیشتر (تعداد تست و تحلیل)" })]
    );

    var form = el("div", { class: "stack" }, [
      basics,
      el("div", { class: "field__label", text: "درصد هر درس" }),
      pctWrap,
      moreBtn,
      advanced
    ]);

    UI.openModal({
      title: exam ? "ویرایش آزمون" : "ثبت آزمون جدید",
      size: "wide",
      body: form,
      footer: [
        UI.button("بستن", { onClick: UI.closeModal }),
        UI.button("ذخیره", {
          variant: "primary",
          size: "lg",
          icon: "check",
          onClick: function () {
            var name = UI.valueOf(form, "name").trim();
            if (!name) {
              UI.toast("اسم آزمون را بنویس.", "danger");
              return;
            }
            var iso = D.jalaliInputToISO(UI.valueOf(form, "date"));
            if (!iso) {
              UI.toast("تاریخ درست نیست. مثل ۱۴۰۵/۰۵/۲۶ بنویس.", "danger");
              return;
            }

            var payload = {
              name: name,
              date: iso,
              type: exam ? exam.type : "mock",
              scoreMode: "percentage",
              subjectIds: chosen,
              targetPercentage: exam ? exam.targetPercentage : null,
              consultantNote: exam ? exam.consultantNote : ""
            };
            var id = exam ? (A.updateExam(exam.id, payload), exam.id) : A.addExam(payload);

            /* Build subject results: counts win when present. */
            var entries = [];
            var errors = [];
            chosen.forEach(function (sid) {
              var total = UI.numberOf(form, "c_" + sid + "_total", 0) || 0;
              var correct = UI.numberOf(form, "c_" + sid + "_correct", 0) || 0;
              var wrong = UI.numberOf(form, "c_" + sid + "_wrong", 0) || 0;
              var blank = UI.numberOf(form, "c_" + sid + "_blank", 0) || 0;
              var pct = UI.numberOf(form, "p_" + sid, null);

              if (total > 0 && correct + wrong + blank > total) {
                errors.push(
                  Q.subjectName(sid) + ": مجموع درست و غلط و نزده از کل بیشتر است."
                );
              }
              entries.push({
                subjectId: sid,
                totalQuestions: total,
                correct: correct,
                wrong: wrong,
                unanswered: blank,
                score: null,
                percentage: pct
              });
            });

            if (errors.length) {
              UI.toast(errors[0], "danger", 5000);
              advanced.hidden = false;
              return;
            }

            A.setExamResult(id, {
              taken: true,
              taraz: UI.numberOf(form, "taraz", null),
              rank: UI.numberOf(form, "rank", null),
              subjectResults: entries,
              analysis: {
                good: UI.valueOf(form, "aGood"),
                bad: UI.valueOf(form, "aBad"),
                mistakes: (result.analysis && result.analysis.mistakes) || "",
                review: UI.valueOf(form, "aReview"),
                time: (result.analysis && result.analysis.time) || ""
              },
              studentNote: result.studentNote || ""
            });

            UI.closeModal();
            UI.toast("آزمون ثبت شد.", "success");
          }
        })
      ]
    });
  };

  /* Kept so the consultant planner can still open the full editor. */
  E.openExamEditor = function (examId) {
    E.openExamForm(examId);
  };

  E.openExamDetails = function (examId) {
    var es = S.examStats(examId);
    if (!es) return;
    UI.openModal({
      title: es.name,
      subtitle: D.format(es.date, "full"),
      size: "wide",
      body: examDetails(es),
      footer: [
        UI.button("بستن", { onClick: UI.closeModal }),
        UI.button("ویرایش", {
          variant: "primary",
          onClick: function () {
            UI.closeModal();
            E.openExamForm(examId);
          }
        })
      ]
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
