(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var A = HDML.actions;
  var Q = HDML.query;
  var S = HDML.stats;
  var el = UI.el;

  var T = (HDML.taskUI = {});

  /**
   * @param {Object} ts stats.taskStats() result
   * @param {{readOnly?:boolean}} [options]
   */
  T.card = function (ts, options) {
    var opts = options || {};
    var task = ts.task;
    var color = Q.subjectColor(task.subjectId);
    var running = A.runningTaskId() === task.id;

    var classes = ["task-simple"];
    if (ts.isCompleted) classes.push("is-done");
    if (ts.isSkipped) classes.push("is-skipped");
    if (running) classes.push("is-running");

    var body = el(
      "button",
      {
        type: "button",
        class: "task-simple__body",
        "aria-label": "جزئیات " + (task.title || "فعالیت"),
        onclick: function () {
          T.openDetails(task.id);
        }
      },
      [
        el("div", { class: "row", style: { gap: "8px" } }, [
          ts.isCompleted
            ? el("span", { class: "task-simple__tick task-simple__tick--done" }, UI.icon("check"))
            : null,
          ts.isSkipped
            ? el("span", { class: "task-simple__tick task-simple__tick--skip" }, UI.icon("minus"))
            : null,
          el("span", { class: "task-simple__subject", text: Q.subjectName(task.subjectId) })
        ]),
        task.topic ? el("div", { class: "task-simple__topic", text: task.topic }) : null,
        el("div", { class: "task-simple__title", text: task.title || "فعالیت" }),
        el("div", { class: "task-simple__time" }, [
          el("span", { class: "task-simple__chip" }, [
            el("span", { text: "⏱" }),
            el("strong", { text: util.fmtDur(ts.plannedMinutes) })
          ]),
          task.targetQuestions
            ? el("span", { class: "task-simple__chip" }, [
                el("span", { text: "🎯" }),
                el("strong", { text: util.n(task.targetQuestions) + " تست" })
              ])
            : null,
          running
            ? el("span", { class: "timer-pill", dataset: { timerFor: task.id } }, [
                el("span", { class: "timer-pill__dot" }),
                el("span", { class: "timer-value", text: formatClock(A.timerMinutes(task.id)) })
              ])
            : null
        ]),
        resultLine(ts)
      ]
    );

    var foot = opts.readOnly ? null : el("div", { class: "task-simple__foot" }, footer(ts, running));

    return el(
      "article",
      {
        class: classes.join(" "),
        style: { "--task-color": color },
        dataset: { taskId: task.id }
      },
      [body, foot]
    );
  };

  /** The one line of "what actually happened", shown only once it exists. */
  function resultLine(ts) {
    if (ts.isSkipped) {
      return el("div", { class: "task-simple__result", style: { color: "#b06f0a" } }, [
        el("span", { text: "انجام نشد — " + util.skipReasonLabel(ts.skipReason) })
      ]);
    }
    if (!ts.isCompleted) return null;

    var parts = [util.fmtDur(ts.actualMinutes) + " خوندی"];
    if (ts.questionsCompleted) parts.push(util.n(ts.questionsCompleted) + " تست");
    if (ts.accuracy !== null) parts.push(util.fmtPct(ts.accuracy) + " درست");

    return el("div", { class: "task-simple__result" }, [
      UI.icon("check", 15),
      el("span", { text: parts.join(" · ") }),
      ts.isEstimated
        ? el("span", {
            class: "text-xs",
            style: { color: "#b06f0a", "font-weight": "400" },
            text: "(زمان دقیق ثبت نشده)"
          })
        : null
    ]);
  }

  function footer(ts, running) {
    var id = ts.taskId;

    if (ts.isCompleted) {
      return el("div", { class: "mini-actions" }, [
        el("button", {
          type: "button",
          class: "mini-link",
          text: "✏️ ویرایش",
          onclick: function () {
            T.openComplete(id);
          }
        }),
        el("button", {
          type: "button",
          class: "mini-link",
          text: "↩️ برگردان به انجام‌نشده",
          onclick: function () {
            UI.confirm({
              title: "برگرداندن این کار",
              message: "زمان و تست‌هایی که ثبت کردی پاک می‌شود. مطمئنی؟"
            }).then(function (ok) {
              if (ok) {
                A.resetTask(id);
                UI.toast("برگردانده شد.");
              }
            });
          }
        })
      ]);
    }

    if (ts.isSkipped) {
      return el("div", { class: "mini-actions" }, [
        el("button", {
          type: "button",
          class: "mini-link",
          text: "✅ در واقع انجامش دادم",
          onclick: function () {
            T.openComplete(id);
          }
        })
      ]);
    }

    return el("div", {}, [
      el(
        "button",
        {
          type: "button",
          class: "done-btn",
          onclick: function () {
            T.openComplete(id);
          }
        },
        [UI.icon("check"), el("span", { text: "انجام شد" })]
      ),
      el("div", { class: "mini-actions" }, [
        el("button", {
          type: "button",
          class: "mini-link",
          text: running ? "⏹ توقف زمان‌سنج" : "▶️ شروع زمان‌سنج",
          onclick: function () {
            if (running) {
              A.stopTimer(id);
              UI.toast("زمان ثبت شد.", "success");
            } else {
              A.startTimer(id);
              UI.toast("زمان‌سنج شروع شد.", "success");
            }
          }
        }),
        el("button", {
          type: "button",
          class: "mini-link",
          text: "✖️ انجام نشد",
          onclick: function () {
            T.openSkip(id);
          }
        })
      ])
    ]);
  }

  function formatClock(minutes) {
    var totalSeconds = Math.floor(minutes * 60);
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    function p(v) {
      return v < 10 ? "0" + v : String(v);
    }
    return util.n(h > 0 ? h + ":" + p(m) + ":" + p(s) : p(m) + ":" + p(s));
  }

  T.formatClock = formatClock;

  /**
   * Two questions, nothing more:
   *   چقدر زمان برد؟   چند تست زدی؟
   * Correct/wrong/blank and a note hide behind "جزئیات بیشتر".
   */
  T.openComplete = function (taskId) {
    var state = HDML.store.get();
    var task = state.consultant.tasks[taskId];
    if (!task) return;
    var ts = S.taskStats(task, state);
    var timerMinutes = Math.round(A.timerMinutes(taskId));
    var wantsQuestions =
      util.taskTypeHasQuestions(task.type) || task.targetQuestions > 0;

    var suggested =
      ts.hasRecordedTime && ts.actualMinutes
        ? ts.actualMinutes
        : timerMinutes > 0
        ? timerMinutes
        : task.plannedMinutes || "";

    var q = (ts.log && ts.log.questions) || null;
    var errorBox = el("div", {});

    var minutesField = UI.field({
      label: "انجام این کار چقدر طول کشید؟ (دقیقه)",
      name: "actualMinutes",
      type: "number",
      min: 0,
      max: 1440,
      inputmode: "numeric",
      controlClass: "input--num",
      value: suggested
    });

    var quick = el("div", { class: "btn-row", style: { "margin-top": "8px" } });
    var choices = [15, 30, 45, 60, 90, 120];
    if (task.plannedMinutes && choices.indexOf(task.plannedMinutes) < 0) {
      choices.unshift(task.plannedMinutes);
    }
    choices.forEach(function (m) {
      quick.appendChild(
        UI.button(util.n(m), {
          size: "sm",
          onClick: function () {
            var input = minutesField.querySelector('[name="actualMinutes"]');
            if (input) input.value = String(m);
          }
        })
      );
    });
    minutesField.appendChild(quick);

    /* Only the per-answer breakdown hides; the note is a first-class field. */
    var advanced = el("div", { class: "more-panel", hidden: true }, [
      el("div", { class: "form-grid" }, [
        wantsQuestions
          ? UI.field({
              label: "درست",
              name: "qCorrect",
              type: "number",
              min: 0,
              inputmode: "numeric",
              controlClass: "input--num",
              value: q ? q.correct : ""
            })
          : null,
        wantsQuestions
          ? UI.field({
              label: "غلط",
              name: "qWrong",
              type: "number",
              min: 0,
              inputmode: "numeric",
              controlClass: "input--num",
              value: q ? q.wrong : ""
            })
          : null,
        wantsQuestions
          ? UI.field({
              label: "نزده",
              name: "qUnanswered",
              type: "number",
              min: 0,
              inputmode: "numeric",
              controlClass: "input--num",
              value: q ? q.unanswered : ""
            })
          : null
      ])
    ]);

    var noteField = UI.field({
      label: "یادداشت (اختیاری)",
      name: "note",
      type: "textarea",
      rows: 2,
      full: true,
      placeholder: "مثلاً: این مبحث را باید دوباره دوره کنم.",
      value: ts.log ? ts.log.note : ""
    });

    var moreBtn = wantsQuestions
      ? el(
          "button",
          {
            type: "button",
            class: "more-toggle",
            "aria-expanded": "false",
            onclick: function () {
              var open = advanced.hidden;
              advanced.hidden = !open;
              moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
            }
          },
          [UI.icon("chevronDown"), el("span", { text: "درست / غلط / نزده" })]
        )
      : null;

    var form = el("div", { class: "stack" }, [
      minutesField,
      wantsQuestions
        ? UI.field({
            label:
              "چند تست زدی؟" +
              (task.targetQuestions ? " (هدف: " + util.n(task.targetQuestions) + ")" : ""),
            name: "qCompleted",
            type: "number",
            min: 0,
            inputmode: "numeric",
            controlClass: "input--num",
            value: q ? q.completed : ""
          })
        : null,
      moreBtn,
      advanced,
      noteField,
      errorBox
    ]);

    function readValues() {
      var values = { actualMinutes: UI.numberOf(form, "actualMinutes", null) };
      if (wantsQuestions) {
        values.questions = A.normalizeQuestions({
          completed: UI.numberOf(form, "qCompleted", 0) || 0,
          correct: UI.numberOf(form, "qCorrect", 0) || 0,
          wrong: UI.numberOf(form, "qWrong", 0) || 0,
          unanswered: UI.numberOf(form, "qUnanswered", 0) || 0
        });
      }
      values.note = UI.valueOf(form, "note");
      return values;
    }

    UI.openModal({
      title: "انجام شد ✅",
      subtitle: task.title,
      body: form,
      footer: [
        UI.button("بستن", { onClick: UI.closeModal }),
        UI.button("ذخیره", {
          variant: "primary",
          size: "lg",
          icon: "check",
          onClick: function () {
            var values = readValues();
            var errors = A.validateCompletion(values, task);
            UI.clear(errorBox);
            if (errors.length) {
              errors.forEach(function (msg) {
                errorBox.appendChild(UI.notice(util.escapeHtml(msg), "danger"));
              });
              /* Most validation failures are about the answer breakdown, so
                 reveal it - but it only exists for question-based tasks. */
              if (moreBtn) {
                advanced.hidden = false;
                moreBtn.setAttribute("aria-expanded", "true");
              }
              return;
            }
            A.completeTask(taskId, values);
            UI.closeModal();
            UI.toast("آفرین! ثبت شد.", "success");
          }
        })
      ]
    });
  };

  T.openSkip = function (taskId) {
    var state = HDML.store.get();
    var task = state.consultant.tasks[taskId];
    if (!task) return;
    var log = state.student.taskLogs[taskId];
    var selected = (log && log.skipReason) || null;

    var buttons = [];
    var list = el(
      "div",
      { class: "reason-list" },
      HDML.SKIP_REASONS.map(function (reason) {
        var btn = el("button", {
          type: "button",
          class: "reason-option",
          text: reason.label,
          "aria-pressed": selected === reason.id ? "true" : "false",
          onclick: function () {
            selected = reason.id;
            buttons.forEach(function (b) {
              b.setAttribute("aria-pressed", b === btn ? "true" : "false");
            });
          }
        });
        buttons.push(btn);
        return btn;
      })
    );

    var form = el("div", { class: "stack" }, [
      el("p", { class: "text-sm text-muted", text: "چرا نشد؟ (برای مشاورت مفیده)" }),
      list
    ]);

    UI.openModal({
      title: "این کار انجام نشد",
      subtitle: task.title,
      body: form,
      footer: [
        UI.button("بستن", { onClick: UI.closeModal }),
        UI.button("ثبت", {
          variant: "primary",
          onClick: function () {
            if (!selected) {
              UI.toast("یک دلیل انتخاب کن.", "danger");
              return;
            }
            A.skipTask(taskId, selected, "");
            UI.closeModal();
            UI.toast("ثبت شد.");
          }
        })
      ]
    });
  };

  T.openDetails = function (taskId) {
    var state = HDML.store.get();
    var task = state.consultant.tasks[taskId];
    if (!task) return;
    var ts = S.taskStats(task, state);

    var rows = [
      UI.kv("درس", Q.subjectName(task.subjectId)),
      task.topic ? UI.kv("مبحث", task.topic) : null,
      UI.kv("نوع", util.taskTypeLabel(task.type)),
      UI.kv("زمان برنامه", util.fmtDur(ts.plannedMinutes)),
      ts.actualMinutes > 0
        ? UI.kv(
            "زمان واقعی",
            util.fmtDur(ts.actualMinutes) + (ts.isEstimated ? " (تخمینی)" : "")
          )
        : null,
      task.targetQuestions ? UI.kv("تست هدف", util.n(task.targetQuestions)) : null,
      ts.questionsCompleted ? UI.kv("تست زده‌شده", util.n(ts.questionsCompleted)) : null,
      ts.questionsCompleted
        ? UI.kv(
            "درست / غلط / نزده",
            util.n(ts.correct) + " / " + util.n(ts.wrong) + " / " + util.n(ts.unanswered)
          )
        : null,
      ts.accuracy !== null ? UI.kv("درصد درست", util.fmtPct(ts.accuracy)) : null
    ];

    var body = el("div", { class: "stack" }, [
      task.description
        ? el("p", { class: "text-sm", style: { "white-space": "pre-wrap" }, text: task.description })
        : null,
      el("div", {}, rows),
      task.consultantNote
        ? UI.noteBlock("پیام مشاور", task.consultantNote, "consultant")
        : null,
      ts.note ? UI.noteBlock("یادداشت تو", ts.note, "student") : null
    ]);

    UI.openModal({
      title: task.title || "فعالیت",
      body: body,
      footer: [
        UI.button("بستن", { onClick: UI.closeModal }),
        ts.isCompleted
          ? UI.button("ویرایش", {
              variant: "primary",
              icon: "edit",
              onClick: function () {
                UI.closeModal();
                T.openComplete(taskId);
              }
            })
          : UI.button("انجام شد", {
              variant: "primary",
              icon: "check",
              onClick: function () {
                UI.closeModal();
                T.openComplete(taskId);
              }
            })
      ]
    });
  };

  /** Three plain chips. No subject/type dropdowns on the student screens. */
  T.filterBar = function (taskStatsList, onChange) {
    var filter = HDML.store.get().ui.taskFilter || { status: "all" };

    var options = [
      { id: "all", label: "همه", count: taskStatsList.length },
      {
        id: "pending",
        label: "مانده",
        count: taskStatsList.filter(function (t) {
          return t.isPending || t.isInProgress;
        }).length
      },
      {
        id: "completed",
        label: "انجام‌شده",
        count: taskStatsList.filter(function (t) {
          return t.isCompleted;
        }).length
      }
    ];

    return el(
      "div",
      { class: "filter-bar" },
      options.map(function (opt) {
        return el(
          "button",
          {
            type: "button",
            class: "chip",
            "aria-pressed": filter.status === opt.id ? "true" : "false",
            onclick: function () {
              A.setUi({ taskFilter: { status: opt.id, subjectId: "all", type: "all" } });
              if (onChange) onChange();
            }
          },
          [
            el("span", { text: opt.label }),
            el("span", { class: "chip__count", text: " " + util.n(opt.count) })
          ]
        );
      })
    );
  };

  T.applyFilter = function (taskStatsList) {
    var f = HDML.store.get().ui.taskFilter || {};
    return taskStatsList.filter(function (t) {
      if (f.status === "pending") return t.isPending || t.isInProgress;
      if (f.status === "completed") return t.isCompleted;
      if (f.status === "skipped") return t.isSkipped;
      return true;
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
