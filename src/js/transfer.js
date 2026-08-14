/* ==========================================================================
   transfer.js - export / import

   The lifecycle this implements:
     consultant builds plan
       -> "خروجی HTML دانش‌آموز"  (a self-contained copy of THIS app + plan)
       -> student works in that file
       -> "خروجی عملکرد" (activity JSON)
       -> consultant imports it, reviews, builds next week
   ========================================================================== */
(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var D = HDML.date;
  var Q = HDML.query;
  var el = UI.el;

  var TR = (HDML.transfer = {});

  var DATA_TAG_OPEN = '<script id="hdml-data" type="application/json">';
  var DATA_TAG_CLOSE = "<\/script>";

  TR.downloadFile = function (content, filename, mime) {
    try {
      var blob = new global.Blob([content], {
        type: mime || "application/octet-stream"
      });
      var url = global.URL.createObjectURL(blob);
      var a = global.document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      global.document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        global.document.body.removeChild(a);
        global.URL.revokeObjectURL(url);
      }, 1200);
      return true;
    } catch (err) {
      if (global.console) console.error(err);
      UI.toast(
        "ذخیره‌ی فایل ناموفق بود. مرورگر اجازه‌ی دانلود نداد.",
        "danger",
        5000
      );
      return false;
    }
  };

  function stamp() {
    var j = D.jalaliOf(D.today());
    function p(n) {
      return n < 10 ? "0" + n : String(n);
    }
    return j.jy + "-" + p(j.jm) + "-" + p(j.jd);
  }

  function studentSlug() {
    return HDML.reports.sanitizeFilename(Q.studentFullName() || "student");
  }

  /** JSON that can live safely inside a <script> tag. */
  function safeJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  TR.safeJson = safeJson;

  /**
   * Rewrites the payload inside a pristine copy of this document.
   * @returns {string|null} full HTML, or null when the tag is missing
   */
  TR.embedPayload = function (html, payload) {
    var startIdx = html.indexOf(DATA_TAG_OPEN);
    if (startIdx < 0) return null;
    var contentStart = startIdx + DATA_TAG_OPEN.length;
    var endIdx = html.indexOf(DATA_TAG_CLOSE, contentStart);
    if (endIdx < 0) return null;
    return (
      html.slice(0, contentStart) + safeJson(payload) + html.slice(endIdx)
    );
  };

  TR.exportStudentHtml = function () {
    var state = HDML.store.get();

    if (!HDML.PRISTINE_HTML) {
      UI.toast("امکان ساخت فایل خروجی در این حالت وجود ندارد.", "danger");
      return;
    }
    if (HDML.IS_MULTIFILE) {
      UI.confirm({
        title: "این نسخه، نسخه‌ی توسعه است",
        message:
          "شما نسخه‌ی چندفایلی (<code>src/index.html</code>) را باز کرده‌اید. فایل خروجی به CSS و JS بیرونی وابسته می‌ماند و روی رایانه‌ی دانش‌آموز کار نمی‌کند.",
        detail:
          "برای تحویل به دانش‌آموز، فایل تک‌فایلی <strong>dist/student.html</strong> را باز کنید و از همان‌جا خروجی بگیرید.",
        confirmLabel: "با این‌حال خروجی بگیر",
        danger: true
      }).then(function (ok) {
        if (ok) doExportStudentHtml(state);
      });
      return;
    }
    doExportStudentHtml(state);
  };

  function doExportStudentHtml(state) {
    var includeActivity = { value: false };

    includeActivity.value = true;

    var form = el("div", { class: "stack" }, [
      UI.notice(
        "یک فایل HTML ساخته می‌شود که <strong>همه‌چیز داخل خودش است</strong>: برنامه، کارهای انجام‌شده، زمان مطالعه، تست‌ها، آزمون‌ها و یادداشت‌ها. هر وقت این فایل را باز کنی، همه‌چیز سر جایش است.",
        "info"
      ),
      el("label", { class: "check-row" }, [
        (function () {
          var cb = el("input", {
            type: "checkbox",
            onchange: function (e) {
              includeActivity.value = e.target.checked;
            }
          });
          cb.checked = true;
          return cb;
        })(),
        el("span", { text: "کارهای انجام‌شده و نتایج من هم داخل فایل باشد" })
      ]),
      UI.notice(
        "اگر تیک بالا را برداری، فایل فقط شامل برنامه می‌شود (مناسب برای وقتی می‌خواهی برنامه را به کسی بدهی).",
        "warning"
      )
    ]);

    UI.openModal({
      title: "💾 ذخیره و دریافت فایل جدید",
      body: form,
      footer: [
        UI.button("بستن", { onClick: UI.closeModal }),
        UI.button("ساخت فایل", {
          variant: "primary",
          size: "lg",
          icon: "download",
          onClick: function () {
            var payload = util.clone(state);
            payload.meta.exportedForStudent = true;
            payload.meta.exportedAt = D.now();
            payload.ui = {
              view: "today",
              currentWeekId: HDML.store.pickCurrentWeek(payload),
              selectedDate: null,
              taskFilter: { status: "all", subjectId: "all", type: "all" },
              consultantUnlocked: false
            };

            if (!includeActivity.value) {
              payload.student = {
                taskLogs: {},
                timers: {},
                dailyNotes: {},
                weeklyReflections: {},
                examResults: {}
              };
            }

            var html = TR.embedPayload(HDML.PRISTINE_HTML, payload);
            if (!html) {
              UI.toast("ساخت فایل ناموفق بود.", "danger");
              return;
            }
            /* e.g. ENIGMA-امیر-رضایی-هفته-۳-Updated.html */
            var week = Q.currentWeek(state);
            var weekPart = week
              ? "-" + HDML.reports.sanitizeFilename(week.title)
              : "";
            TR.downloadFile(
              html,
              "ENIGMA-" + studentSlug() + weekPart + "-Updated.html",
              "text/html;charset=utf-8"
            );
            UI.closeModal();
            UI.toast("فایل ساخته شد. در پوشه‌ی دانلودها پیدایش می‌کنی.", "success", 4500);
          }
        })
      ]
    });
  }

  /** Student performance only - what the consultant imports back. */
  TR.exportActivity = function () {
    var state = HDML.store.get();
    var payload = {
      kind: "hdml-activity",
      schemaVersion: HDML.SCHEMA_VERSION,
      appVersion: HDML.VERSION,
      exportedAt: D.now(),
      studentId: state.consultant.student.id,
      studentName: Q.studentFullName(state),
      planStamp: state.meta.planStamp,
      weeks: Q.weeksSorted(state).map(function (w) {
        return { id: w.id, title: w.title, startDate: w.startDate, endDate: w.endDate };
      }),
      student: util.clone(state.student)
    };
    TR.downloadFile(
      JSON.stringify(payload, null, 2),
      "ENIGMA-" + studentSlug() + "-" + stamp() + "-activity.json",
      "application/json"
    );
    UI.toast("فایل عملکرد ذخیره شد.", "success");
  };

  /** Everything - the safety net before any destructive action. */
  TR.exportBackup = function () {
    var state = HDML.store.get();
    var payload = {
      kind: "hdml-backup",
      schemaVersion: HDML.SCHEMA_VERSION,
      appVersion: HDML.VERSION,
      exportedAt: D.now(),
      state: util.clone(state)
    };
    TR.downloadFile(
      JSON.stringify(payload, null, 2),
      "ENIGMA-" + studentSlug() + "-" + stamp() + "-backup.json",
      "application/json"
    );
    UI.toast("پشتیبان ذخیره شد.", "success");
  };

  /**
   * Structural validation. Returns { ok, kind, errors[], warnings[], info{} }.
   * A failed validation NEVER touches existing data.
   */
  TR.validateImport = function (raw) {
    var result = { ok: false, kind: null, errors: [], warnings: [], info: {} };

    if (!util.isObject(raw)) {
      result.errors.push("فایل واردشده یک شیء JSON معتبر نیست.");
      return result;
    }

    var state = HDML.store.get();

    if (raw.kind === "hdml-backup" || (raw.state && raw.state.consultant)) {
      result.kind = "backup";
      var st = raw.state;
      if (!util.isObject(st) || !util.isObject(st.consultant) || !util.isObject(st.student)) {
        result.errors.push("ساختار پشتیبان ناقص است (بخش consultant یا student یافت نشد).");
        return result;
      }
      result.info = {
        studentName:
          ((st.consultant.student && st.consultant.student.firstName) || "") +
          " " +
          ((st.consultant.student && st.consultant.student.lastName) || ""),
        weeks: Object.keys(st.consultant.weeks || {}).length,
        tasks: Object.keys(st.consultant.tasks || {}).length,
        exams: Object.keys(st.consultant.exams || {}).length,
        logs: Object.keys(st.student.taskLogs || {}).length,
        exportedAt: raw.exportedAt || (st.meta && st.meta.updatedAt) || null
      };
      if (raw.schemaVersion && raw.schemaVersion > HDML.SCHEMA_VERSION) {
        result.warnings.push(
          "این فایل با نسخه‌ی جدیدتری از برنامه ساخته شده است؛ ممکن است بخشی از اطلاعات پشتیبانی نشود."
        );
      }
      result.ok = true;
      return result;
    }

    if (raw.kind === "hdml-activity" || (raw.student && !raw.consultant)) {
      result.kind = "activity";
      var s = raw.student;
      if (!util.isObject(s) || !util.isObject(s.taskLogs)) {
        result.errors.push("ساختار فایل عملکرد ناقص است (بخش taskLogs یافت نشد).");
        return result;
      }

      var logIds = Object.keys(s.taskLogs);
      var known = 0;
      var unknown = 0;
      logIds.forEach(function (id) {
        if (state.consultant.tasks[id]) known++;
        else unknown++;
      });

      var badLogs = 0;
      logIds.forEach(function (id) {
        var log = s.taskLogs[id];
        if (!util.isObject(log)) {
          badLogs++;
          return;
        }
        if (
          log.actualMinutes !== null &&
          log.actualMinutes !== undefined &&
          (!isFinite(log.actualMinutes) || log.actualMinutes < 0)
        ) {
          badLogs++;
        }
      });

      if (badLogs) {
        result.errors.push(
          util.n(badLogs) + " رکورد عملکرد مقدار نامعتبر دارد. ورود اطلاعات انجام نشد."
        );
        return result;
      }

      if (raw.studentId && raw.studentId !== state.consultant.student.id) {
        result.warnings.push(
          "شناسه‌ی دانش‌آموز این فایل با دانش‌آموز فعلی یکسان نیست" +
            (raw.studentName ? " (فایل: " + raw.studentName + ")" : "") +
            ". مطمئن شوید فایل درست را انتخاب کرده‌اید."
        );
      }
      if (unknown) {
        result.warnings.push(
          util.n(unknown) +
            " رکورد مربوط به فعالیت‌هایی است که در برنامه‌ی فعلی وجود ندارند و نادیده گرفته می‌شوند."
        );
      }
      if (!known) {
        result.warnings.push(
          "هیچ‌کدام از رکوردها با فعالیت‌های برنامه‌ی فعلی مطابقت ندارند. احتمالاً فایل مربوط به برنامه‌ی دیگری است."
        );
      }

      result.info = {
        studentName: raw.studentName || "—",
        logs: logIds.length,
        matched: known,
        unmatched: unknown,
        exams: Object.keys(s.examResults || {}).length,
        notes: Object.keys(s.dailyNotes || {}).length,
        exportedAt: raw.exportedAt || null
      };
      result.ok = true;
      return result;
    }

    result.errors.push(
      "نوع فایل شناسایی نشد. فایل باید خروجی «عملکرد» یا «پشتیبان» همین برنامه باشد."
    );
    return result;
  };

  TR.openImportDialog = function (expectedKind) {
    var input = el("input", {
      type: "file",
      accept: ".json,application/json",
      class: "input",
      onchange: function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new global.FileReader();
        reader.onload = function () {
          var raw;
          try {
            raw = JSON.parse(reader.result);
          } catch (err) {
            showResult(
              null,
              ["فایل انتخاب‌شده JSON معتبر نیست و خوانده نشد."],
              null
            );
            return;
          }
          var validation = TR.validateImport(raw);
          if (!validation.ok) {
            showResult(null, validation.errors, null);
            return;
          }
          if (expectedKind && validation.kind !== expectedKind) {
            showResult(
              null,
              [
                expectedKind === "activity"
                  ? "این فایل، فایل عملکرد دانش‌آموز نیست."
                  : "این فایل، فایل پشتیبان نیست."
              ],
              null
            );
            return;
          }
          showResult(raw, [], validation);
        };
        reader.onerror = function () {
          showResult(null, ["خواندن فایل ناموفق بود."], null);
        };
        reader.readAsText(file);
      }
    });

    var resultBox = el("div", { class: "stack" });

    function showResult(raw, errors, validation) {
      UI.clear(resultBox);
      if (errors && errors.length) {
        errors.forEach(function (msg) {
          resultBox.appendChild(UI.notice(util.escapeHtml(msg), "danger"));
        });
        resultBox.appendChild(
          UI.notice("هیچ تغییری در اطلاعات فعلی ایجاد نشد.", "info")
        );
        return;
      }
      if (!validation) return;

      var info = validation.info;
      resultBox.appendChild(
        UI.notice(
          "فایل معتبر است. پیش از تأیید، خلاصه‌ی زیر را بررسی کنید.",
          "success"
        )
      );
      validation.warnings.forEach(function (w) {
        resultBox.appendChild(UI.notice(util.escapeHtml(w), "warning"));
      });

      var rows =
        validation.kind === "backup"
          ? [
              ["دانش‌آموز", (info.studentName || "").trim() || "—"],
              ["تعداد هفته", util.n(info.weeks)],
              ["تعداد فعالیت", util.n(info.tasks)],
              ["تعداد آزمون", util.n(info.exams)],
              ["رکورد عملکرد", util.n(info.logs)]
            ]
          : [
              ["دانش‌آموز", info.studentName],
              ["رکورد عملکرد", util.n(info.logs)],
              ["منطبق با برنامه‌ی فعلی", util.n(info.matched)],
              ["بدون تطابق", util.n(info.unmatched)],
              ["نتیجه‌ی آزمون", util.n(info.exams)],
              ["یادداشت روزانه", util.n(info.notes)]
            ];

      if (info.exportedAt) {
        rows.push(["تاریخ خروجی", String(info.exportedAt).slice(0, 10)]);
      }

      resultBox.appendChild(
        el(
          "div",
          { class: "card" },
          el(
            "div",
            { class: "card__body" },
            rows.map(function (r) {
              return UI.kv(r[0], r[1]);
            })
          )
        )
      );

      if (validation.kind === "activity") {
        resultBox.appendChild(
          el("div", { class: "btn-row" }, [
            UI.button("ادغام با اطلاعات فعلی", {
              variant: "primary",
              icon: "upload",
              onClick: function () {
                applyActivity(raw, "merge");
              }
            }),
            UI.button("جایگزینی کامل عملکرد", {
              variant: "danger-ghost",
              icon: "refresh",
              onClick: function () {
                UI.confirm({
                  title: "جایگزینی عملکرد",
                  message:
                    "همه‌ی عملکرد ثبت‌شده‌ی فعلی پاک و با محتوای این فایل جایگزین می‌شود. برنامه‌ی مشاور دست‌نخورده می‌ماند.",
                  danger: true,
                  confirmLabel: "جایگزین کن"
                }).then(function (ok) {
                  if (ok) applyActivity(raw, "replace");
                });
              }
            })
          ])
        );
        resultBox.appendChild(
          UI.notice(
            "<strong>ادغام:</strong> رکوردهای فایل روی رکوردهای هم‌نام نوشته می‌شود و بقیه دست‌نخورده می‌مانند.<br><strong>جایگزینی:</strong> کل عملکرد فعلی با فایل عوض می‌شود.",
            "info"
          )
        );
      } else {
        resultBox.appendChild(
          UI.button("بازیابی کامل از پشتیبان", {
            variant: "danger-ghost",
            icon: "upload",
            onClick: function () {
              UI.confirm({
                title: "بازیابی از پشتیبان",
                message:
                  "کل اطلاعات فعلی (برنامه و عملکرد) با محتوای این پشتیبان جایگزین می‌شود.",
                detail: "پیش از ادامه، از وضعیت فعلی پشتیبان بگیرید.",
                danger: true,
                confirmLabel: "بازیابی کن"
              }).then(function (ok) {
                if (!ok) return;
                var next = HDML.store.normalize(raw.state);
                HDML.store.replace(next);
                util.usePersianDigits = next.settings.persianDigits !== false;
                UI.closeModal();
                UI.toast("پشتیبان بازیابی شد.", "success");
              });
            }
          })
        );
      }
    }

    function applyActivity(raw, mode) {
      var incoming = raw.student;
      HDML.store.mutate(function (st) {
        if (mode === "replace") {
          st.student = {
            taskLogs: {},
            timers: {},
            dailyNotes: {},
            weeklyReflections: {},
            examResults: {}
          };
        }
        ["taskLogs", "timers", "dailyNotes", "weeklyReflections", "examResults"].forEach(
          function (key) {
            var src = incoming[key];
            if (!util.isObject(src)) return;
            Object.keys(src).forEach(function (id) {
              st.student[key][id] = src[id];
            });
          }
        );
        /* A restored timer must never come back "running". */
        Object.keys(st.student.timers).forEach(function (id) {
          if (st.student.timers[id]) st.student.timers[id].running = null;
        });
      });
      UI.closeModal();
      UI.toast("عملکرد دانش‌آموز وارد شد.", "success");
    }

    UI.openModal({
      title:
        expectedKind === "activity"
          ? "ورود عملکرد دانش‌آموز"
          : expectedKind === "backup"
          ? "بازیابی از پشتیبان"
          : "ورود اطلاعات",
      size: "wide",
      body: el("div", { class: "stack" }, [
        el("div", { class: "field" }, [
          el("span", { class: "field__label", text: "انتخاب فایل JSON" }),
          input,
          el("div", {
            class: "field__hint",
            text: "فایل ابتدا بررسی و پیش‌نمایش می‌شود؛ تا زمان تأیید شما هیچ تغییری اعمال نمی‌گردد."
          })
        ]),
        resultBox
      ]),
      footer: [UI.button("بستن", { onClick: UI.closeModal })]
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
