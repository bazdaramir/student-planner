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
  var el = UI.el;

  HDML.views = HDML.views || {};
  var K = (HDML.consultantUI = {});

  var openDays = {};

  HDML.views.consultant = function (ctx) {
    var state = HDML.store.get();
    var week = Q.currentWeek(state);
    var container = el("div", {});

    container.appendChild(
      el("div", { class: "consultant-strip" }, [
        UI.icon("consultant", 26),
        el("div", {}, [
          el("h2", { text: "حالت مشاور" }),
          el("p", {
            text: "ساخت و ویرایش برنامه‌ی دانش‌آموز. این بخش برای دانش‌آموز فقط‌خواندنی است."
          })
        ]),
        el("div", { class: "consultant-strip__spacer" }),
        UI.button("پیش‌نمایش دانش‌آموز", {
          icon: "eye",
          variant: "gold",
          onClick: function () {
            ctx.navigate("today");
          }
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "مشخصات دانش‌آموز",
          icon: "user",
          actions: UI.button("ویرایش", {
            size: "sm",
            icon: "edit",
            onClick: function () {
              K.openProfileEditor();
            }
          }),
          body: profileSummary(state)
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "دروس",
          icon: "book",
          hint: "هر فعالیت باید به یک درس تعلق داشته باشد",
          actions: el("div", { class: "btn-row" }, [
            UI.button("افزودن درس", {
              size: "sm",
              icon: "plus",
              onClick: function () {
                K.openSubjectEditor(null);
              }
            }),
            UI.button("بارگذاری دروس رشته", {
              size: "sm",
              variant: "ghost",
              onClick: function () {
                K.loadTrackSubjects();
              }
            })
          ]),
          body: subjectList(state, ctx)
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "هفته‌ها",
          icon: "week",
          actions: el("div", { class: "btn-row" }, [
            UI.button("هفته‌ی جدید", {
              size: "sm",
              icon: "plus",
              variant: "primary",
              onClick: function () {
                K.openWeekEditor(null);
              }
            }),
            week
              ? UI.button("کپی هفته‌ی جاری", {
                  size: "sm",
                  icon: "copy",
                  onClick: function () {
                    K.duplicateWeek(week.id);
                  }
                })
              : null,
            week
              ? UI.button("ذخیره به‌عنوان الگو", {
                  size: "sm",
                  variant: "ghost",
                  onClick: function () {
                    K.saveTemplate(week.id);
                  }
                })
              : null,
            state.consultant.templates.length
              ? UI.button("ساخت از الگو", {
                  size: "sm",
                  variant: "ghost",
                  onClick: function () {
                    K.openTemplatePicker();
                  }
                })
              : null
          ]),
          body: weekList(state, ctx)
        })
      ])
    );

    if (!week) {
      container.appendChild(
        UI.empty({
          icon: "week",
          title: "هنوز هفته‌ای ساخته نشده است",
          text: "برای شروع برنامه‌ریزی، یک هفته بسازید و سپس فعالیت‌های هر روز را اضافه کنید.",
          action: UI.button("ساخت اولین هفته", {
            variant: "primary",
            icon: "plus",
            onClick: function () {
              K.openWeekEditor(null);
            }
          })
        })
      );
      return container;
    }

    var ws = S.weekStats(week.id);

    container.appendChild(
      UI.sectionHead(
        "برنامه‌ی " + week.title,
        D.formatRange(week.startDate, week.endDate) +
          " — " +
          util.n(ws.totalTasks) +
          " فعالیت · " +
          util.fmtDur(ws.plannedMinutes) +
          " برنامه‌ریزی‌شده",
        el("div", { class: "row" }, [
          V.weekSwitcher(),
          UI.button(week.locked ? "بازکردن قفل" : "قفل‌کردن هفته", {
            size: "sm",
            icon: week.locked ? "unlock" : "lock",
            variant: week.locked ? "gold" : "ghost",
            onClick: function () {
              A.setWeekLocked(week.id, !week.locked);
              UI.toast(week.locked ? "قفل هفته باز شد." : "هفته قفل شد.");
            }
          })
        ])
      )
    );

    if (week.locked) {
      container.appendChild(
        el(
          "div",
          { class: "view-section" },
          UI.notice(
            "این هفته قفل شده است. برای جلوگیری از تغییر تصادفی برنامه، ویرایش فعالیت‌ها غیرفعال است. دانش‌آموز همچنان می‌تواند عملکرد ثبت کند.",
            "warning"
          )
        )
      );
    }

    var daysSection = el("div", { class: "view-section" });
    Q.daysOfWeek(week.id).forEach(function (day) {
      daysSection.appendChild(plannerDay(day, week, ctx));
    });
    container.appendChild(daysSection);

    container.appendChild(
      el("div", { class: "view-section grid grid--2" }, [
        UI.card({
          title: "یادداشت مشاور برای این هفته",
          icon: "note",
          accent: true,
          body: V.noteEditor({
            label: "این یادداشت به دانش‌آموز نمایش داده می‌شود",
            value: week.consultantNote || "",
            rows: 4,
            onSave: function (v) {
              A.setWeekNote(week.id, v);
            }
          })
        }),
        UI.card({
          title: "بازخورد مشاور بر عملکرد هفته",
          icon: "consultant",
          accent: true,
          body: el("div", { class: "stack" }, [
            UI.notice(
              "این بخش پس از بررسی عملکرد دانش‌آموز نوشته می‌شود و در گزارش هفتگی می‌آید.",
              "info"
            ),
            V.noteEditor({
              label: "بازخورد",
              value:
                (state.consultant.feedback[week.id] &&
                  state.consultant.feedback[week.id].text) ||
                "",
              rows: 4,
              onSave: function (v) {
                A.setConsultantFeedback(week.id, v);
              }
            })
          ])
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "آزمون‌های تعریف‌شده",
          icon: "exam",
          actions: UI.button("افزودن آزمون", {
            size: "sm",
            icon: "plus",
            onClick: function () {
              HDML.examUI.openExamEditor(null);
            }
          }),
          body: examList(state, ctx)
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "تحویل به دانش‌آموز و دریافت عملکرد",
          icon: "download",
          accent: true,
          body: el("div", { class: "stack" }, [
            UI.notice(
              "چرخه‌ی کاری: <strong>ساخت برنامه ← خروجی HTML دانش‌آموز ← ارسال فایل ← ثبت عملکرد توسط دانش‌آموز ← دریافت فایل JSON ← ورود اطلاعات ← ساخت هفته‌ی بعد</strong>",
              "info"
            ),
            el("div", { class: "btn-row" }, [
              UI.button("خروجی HTML دانش‌آموز", {
                variant: "primary",
                icon: "download",
                onClick: function () {
                  HDML.transfer.exportStudentHtml();
                }
              }),
              UI.button("ورود عملکرد دانش‌آموز (JSON)", {
                icon: "upload",
                onClick: function () {
                  HDML.transfer.openImportDialog("activity");
                }
              }),
              UI.button("پشتیبان کامل", {
                icon: "download",
                variant: "ghost",
                onClick: function () {
                  HDML.transfer.exportBackup();
                }
              })
            ])
          ])
        })
      ])
    );

    return container;
  };

  function profileSummary(state) {
    var p = state.consultant.student;
    return el("div", { class: "grid grid--3" }, [
      UI.kv("نام", Q.studentFullName(state)),
      UI.kv("پایه", p.grade || "—"),
      UI.kv("رشته", util.trackLabel(p.track)),
      UI.kv("مشاور", p.consultantName || "—"),
      UI.kv("کد ملی", p.nationalId || "—"),
      UI.kv("هدف", p.goal || "—")
    ]);
  }

  K.openProfileEditor = function () {
    var p = HDML.store.get().consultant.student;
    var form = el("div", { class: "form-grid" }, [
      UI.field({ label: "نام", name: "firstName", value: p.firstName, required: true }),
      UI.field({ label: "نام خانوادگی", name: "lastName", value: p.lastName }),
      UI.field({
        label: "پایه",
        name: "grade",
        type: "select",
        value: p.grade,
        options: HDML.GRADES.map(function (g) {
          return { value: g, label: g };
        })
      }),
      UI.field({
        label: "رشته",
        name: "track",
        type: "select",
        value: p.track,
        options: HDML.TRACKS.map(function (t) {
          return { value: t.id, label: t.label };
        })
      }),
      UI.field({ label: "نام مشاور", name: "consultantName", value: p.consultantName }),
      UI.field({ label: "کد ملی (اختیاری)", name: "nationalId", value: p.nationalId }),
      UI.field({
        label: "هدف / رشته‌ی موردنظر",
        name: "goal",
        value: p.goal,
        full: true,
        placeholder: "مثلاً: مهندسی کامپیوتر شریف"
      })
    ]);

    UI.openModal({
      title: "مشخصات دانش‌آموز",
      size: "wide",
      body: form,
      footer: [
        UI.button("انصراف", { onClick: UI.closeModal }),
        UI.button("ذخیره", {
          variant: "primary",
          icon: "check",
          onClick: function () {
            var firstName = UI.valueOf(form, "firstName").trim();
            if (!firstName) {
              UI.toast("نام دانش‌آموز را وارد کنید.", "danger");
              return;
            }
            A.setProfile({
              firstName: firstName,
              lastName: UI.valueOf(form, "lastName").trim(),
              grade: UI.valueOf(form, "grade"),
              track: UI.valueOf(form, "track"),
              consultantName: UI.valueOf(form, "consultantName").trim(),
              nationalId: UI.valueOf(form, "nationalId").trim(),
              goal: UI.valueOf(form, "goal").trim()
            });
            UI.closeModal();
            UI.toast("مشخصات ذخیره شد.", "success");
          }
        })
      ]
    });
  };

  function subjectList(state, ctx) {
    var subjects = Q.activeSubjects(state);
    if (!subjects.length) {
      return UI.empty({
        icon: "book",
        title: "هنوز درسی تعریف نشده است",
        text: "دروس رشته را بارگذاری کنید یا درس‌ها را دستی اضافه کنید.",
        action: UI.button("بارگذاری دروس رشته", {
          variant: "primary",
          onClick: function () {
            K.loadTrackSubjects();
          }
        })
      });
    }

    return el(
      "div",
      {},
      subjects.map(function (s) {
        var usage = A.subjectsInUse(s.id);
        return el("div", { class: "subject-row" }, [
          el("span", { class: "subject-swatch", style: { background: s.color } }),
          el("div", { style: { "min-width": "0" } }, [
            el("div", { class: "text-strong", text: s.name }),
            el("div", {
              class: "text-xs text-muted",
              text: usage
                ? util.n(usage) + " فعالیت از این درس استفاده می‌کند"
                : "بدون فعالیت"
            })
          ]),
          el("div", { class: "planner-task__actions" }, [
            UI.iconButton("edit", {
              title: "ویرایش درس",
              onClick: function () {
                K.openSubjectEditor(s.id);
              }
            }),
            UI.iconButton("trash", {
              title: "حذف درس",
              danger: true,
              onClick: function () {
                UI.confirm({
                  title: "حذف درس",
                  message: usage
                    ? "این درس در " +
                      util.n(usage) +
                      " فعالیت استفاده شده است. با حذف آن، آن فعالیت‌ها بدون درس می‌مانند. ادامه می‌دهید؟"
                    : "این درس حذف شود؟",
                  danger: true,
                  confirmLabel: "حذف"
                }).then(function (ok) {
                  if (ok) {
                    A.removeSubject(s.id);
                    UI.toast("درس حذف شد.");
                  }
                });
              }
            })
          ])
        ]);
      })
    );
  }

  K.openSubjectEditor = function (subjectId) {
    var state = HDML.store.get();
    var subject = subjectId ? Q.subject(subjectId, state) : null;
    var color = subject
      ? subject.color
      : util.subjectColor(state.consultant.subjects.length);

    var swatches = el(
      "div",
      { class: "row" },
      HDML.SUBJECT_COLORS.map(function (c) {
        var btn = el("button", {
          type: "button",
          class: "subject-swatch",
          style: {
            background: c,
            width: "26px",
            height: "26px",
            cursor: "pointer",
            "box-shadow": c === color ? "0 0 0 3px rgba(35,104,231,0.35)" : "none"
          },
          "aria-label": "رنگ " + c,
          onclick: function () {
            color = c;
            Array.prototype.forEach.call(swatches.children, function (node, i) {
              node.style.boxShadow =
                HDML.SUBJECT_COLORS[i] === color
                  ? "0 0 0 3px rgba(35,104,231,0.35)"
                  : "none";
            });
          }
        });
        return btn;
      })
    );

    var form = el("div", { class: "stack" }, [
      UI.field({
        label: "نام درس",
        name: "name",
        required: true,
        value: subject ? subject.name : ""
      }),
      el("div", { class: "field" }, [
        el("span", { class: "field__label", text: "رنگ" }),
        swatches
      ])
    ]);

    UI.openModal({
      title: subject ? "ویرایش درس" : "افزودن درس",
      size: "narrow",
      body: form,
      footer: [
        UI.button("انصراف", { onClick: UI.closeModal }),
        UI.button("ذخیره", {
          variant: "primary",
          onClick: function () {
            var name = UI.valueOf(form, "name").trim();
            if (!name) {
              UI.toast("نام درس را وارد کنید.", "danger");
              return;
            }
            if (subject) A.updateSubject(subject.id, { name: name, color: color });
            else A.addSubject(name, color);
            UI.closeModal();
            UI.toast("ذخیره شد.", "success");
          }
        })
      ]
    });
  };

  K.loadTrackSubjects = function () {
    var state = HDML.store.get();
    var track = state.consultant.student.track;
    var existing = state.consultant.subjects.length;
    UI.confirm({
      title: "بارگذاری دروس رشته",
      message:
        "دروس پیش‌فرض رشته‌ی «" +
        util.escapeHtml(util.trackLabel(track)) +
        "» جایگزین فهرست فعلی می‌شود." +
        (existing
          ? " فهرست فعلی شامل " + util.n(existing) + " درس است و پاک خواهد شد."
          : ""),
      detail: existing
        ? "فعالیت‌هایی که به دروس فعلی متصل‌اند، بدون درس خواهند شد."
        : null,
      danger: !!existing,
      confirmLabel: "بارگذاری"
    }).then(function (ok) {
      if (ok) {
        A.setDefaultSubjects(track);
        UI.toast("دروس بارگذاری شد.", "success");
      }
    });
  };

  function weekList(state, ctx) {
    var weeks = Q.weeksSorted(state);
    if (!weeks.length) return null;

    return el("div", { class: "table-wrap" }, [
      el("table", { class: "data-table" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { text: "هفته" }),
            el("th", { text: "بازه" }),
            el("th", { class: "num-cell", text: "فعالیت" }),
            el("th", { class: "num-cell", text: "ساعت برنامه" }),
            el("th", { text: "وضعیت" }),
            el("th", { text: "" })
          ])
        ]),
        el(
          "tbody",
          {},
          weeks.map(function (w) {
            var ws = S.weekStats(w.id);
            var isCurrent = w.id === state.ui.currentWeekId;
            return el("tr", { style: isCurrent ? { background: "#eef4ff" } : null }, [
              el("td", { class: "cell-subject", text: w.title }),
              el("td", { text: D.formatRange(w.startDate, w.endDate) }),
              el("td", { class: "num-cell", text: util.n(ws.totalTasks) }),
              el("td", { class: "num-cell", text: util.fmtHM(ws.plannedMinutes) }),
              el("td", {}, [
                w.locked ? UI.badge("قفل", "gold") : UI.badge("باز", "muted"),
                isCurrent ? UI.badge("جاری", "type") : null
              ]),
              el("td", {}, [
                el("div", { class: "planner-task__actions" }, [
                  UI.iconButton("eye", {
                    title: "انتخاب این هفته",
                    onClick: function () {
                      A.setUi({ currentWeekId: w.id, selectedDate: null });
                    }
                  }),
                  UI.iconButton("edit", {
                    title: "ویرایش هفته",
                    onClick: function () {
                      K.openWeekEditor(w.id);
                    }
                  }),
                  UI.iconButton("copy", {
                    title: "کپی این هفته",
                    onClick: function () {
                      K.duplicateWeek(w.id);
                    }
                  }),
                  UI.iconButton("trash", {
                    title: "حذف هفته",
                    danger: true,
                    onClick: function () {
                      UI.confirm({
                        title: "حذف هفته",
                        message:
                          "هفته‌ی «" +
                          util.escapeHtml(w.title) +
                          "» به‌همراه همه‌ی فعالیت‌ها و عملکرد ثبت‌شده‌ی آن حذف می‌شود.",
                        detail: "این عمل قابل بازگشت نیست. پیش از حذف، پشتیبان بگیرید.",
                        danger: true,
                        confirmLabel: "حذف هفته"
                      }).then(function (ok) {
                        if (ok) {
                          A.deleteWeek(w.id);
                          UI.toast("هفته حذف شد.");
                        }
                      });
                    }
                  })
                ])
              ])
            ]);
          })
        )
      ])
    ]);
  }

  K.openWeekEditor = function (weekId) {
    var state = HDML.store.get();
    var week = weekId ? state.consultant.weeks[weekId] : null;
    var weeks = Q.weeksSorted(state);

    var suggestedStart = week
      ? week.startDate
      : weeks.length
      ? D.addDays(weeks[weeks.length - 1].startDate, 7)
      : D.weekStart(D.today());

    var form = el("div", { class: "stack" }, [
      el("div", { class: "form-grid" }, [
        UI.field({
          label: "عنوان هفته",
          name: "title",
          value: week ? week.title : "هفته " + util.n(weeks.length + 1),
          required: true
        }),
        UI.field({
          label: "تاریخ شنبه‌ی هفته (شمسی)",
          name: "startDate",
          value: D.isoToJalaliInput(suggestedStart),
          hint: "قالب: ۱۴۰۵/۰۵/۲۳ — به‌صورت خودکار به شنبه گرد می‌شود"
        })
      ]),
      UI.field({
        label: "یادداشت مشاور برای این هفته",
        name: "note",
        type: "textarea",
        rows: 3,
        full: true,
        value: week ? week.consultantNote : ""
      })
    ]);

    UI.openModal({
      title: week ? "ویرایش هفته" : "هفته‌ی جدید",
      body: form,
      footer: [
        UI.button("انصراف", { onClick: UI.closeModal }),
        UI.button("ذخیره", {
          variant: "primary",
          icon: "check",
          onClick: function () {
            var title = UI.valueOf(form, "title").trim();
            var iso = D.jalaliInputToISO(UI.valueOf(form, "startDate"));
            if (!title) {
              UI.toast("عنوان هفته را وارد کنید.", "danger");
              return;
            }
            if (!iso) {
              UI.toast("تاریخ واردشده معتبر نیست. قالب درست: ۱۴۰۵/۰۵/۲۳", "danger");
              return;
            }
            var start = D.weekStart(iso);
            if (week) {
              A.updateWeek(week.id, {
                title: title,
                startDate: start,
                consultantNote: UI.valueOf(form, "note")
              });
            } else {
              var id = A.createWeek(start, title);
              A.setWeekNote(id, UI.valueOf(form, "note"));
            }
            UI.closeModal();
            UI.toast("هفته ذخیره شد.", "success");
          }
        })
      ]
    });
  };

  K.duplicateWeek = function (weekId) {
    var state = HDML.store.get();
    var src = state.consultant.weeks[weekId];
    if (!src) return;
    var suggested = D.addDays(src.startDate, 7);

    var form = el("div", { class: "stack" }, [
      UI.notice(
        "همه‌ی فعالیت‌های هفته‌ی «" +
          util.escapeHtml(src.title) +
          "» در هفته‌ی جدید کپی می‌شود. عملکرد ثبت‌شده کپی نمی‌شود.",
        "info"
      ),
      UI.field({
        label: "شنبه‌ی هفته‌ی جدید (شمسی)",
        name: "startDate",
        value: D.isoToJalaliInput(suggested)
      })
    ]);

    UI.openModal({
      title: "کپی هفته",
      size: "narrow",
      body: form,
      footer: [
        UI.button("انصراف", { onClick: UI.closeModal }),
        UI.button("کپی", {
          variant: "primary",
          icon: "copy",
          onClick: function () {
            var iso = D.jalaliInputToISO(UI.valueOf(form, "startDate"));
            if (!iso) {
              UI.toast("تاریخ واردشده معتبر نیست.", "danger");
              return;
            }
            A.duplicateWeek(weekId, iso);
            UI.closeModal();
            UI.toast("هفته کپی شد.", "success");
          }
        })
      ]
    });
  };

  K.saveTemplate = function (weekId) {
    var week = HDML.store.get().consultant.weeks[weekId];
    var form = el("div", { class: "stack" }, [
      UI.field({
        label: "نام الگو",
        name: "name",
        value: "الگوی " + (week ? week.title : ""),
        required: true
      }),
      UI.notice(
        "الگو ساختار فعالیت‌های هفته را نگه می‌دارد تا برای دانش‌آموزان دیگر یا هفته‌های بعد استفاده شود.",
        "info"
      )
    ]);

    UI.openModal({
      title: "ذخیره‌ی هفته به‌عنوان الگو",
      size: "narrow",
      body: form,
      footer: [
        UI.button("انصراف", { onClick: UI.closeModal }),
        UI.button("ذخیره", {
          variant: "primary",
          onClick: function () {
            var name = UI.valueOf(form, "name").trim();
            if (!name) {
              UI.toast("نام الگو را وارد کنید.", "danger");
              return;
            }
            A.saveWeekAsTemplate(weekId, name);
            UI.closeModal();
            UI.toast("الگو ذخیره شد.", "success");
          }
        })
      ]
    });
  };

  K.openTemplatePicker = function () {
    var state = HDML.store.get();
    var templates = state.consultant.templates;
    var chosen = templates.length ? templates[0].id : null;

    var list = el(
      "div",
      { class: "stack stack--sm" },
      templates.map(function (t) {
        var count = t.days.reduce(function (a, d) {
          return a + (d.tasks || []).length;
        }, 0);
        var row = el("div", { class: "subject-row" }, [
          el("span", {}),
          el("div", {}, [
            el("div", { class: "text-strong", text: t.name }),
            el("div", {
              class: "text-xs text-muted",
              text: util.n(count) + " فعالیت · " + D.format(t.createdAt.slice(0, 10), "long")
            })
          ]),
          el("div", { class: "planner-task__actions" }, [
            UI.button("استفاده", {
              size: "sm",
              variant: "primary",
              onClick: function () {
                var iso = D.jalaliInputToISO(UI.valueOf(wrap, "startDate"));
                if (!iso) {
                  UI.toast("تاریخ واردشده معتبر نیست.", "danger");
                  return;
                }
                A.createWeekFromTemplate(t.id, iso);
                UI.closeModal();
                UI.toast("هفته از الگو ساخته شد.", "success");
              }
            }),
            UI.iconButton("trash", {
              title: "حذف الگو",
              danger: true,
              onClick: function () {
                A.deleteTemplate(t.id);
                UI.closeModal();
                UI.toast("الگو حذف شد.");
              }
            })
          ])
        ]);
        return row;
      })
    );

    var weeks = Q.weeksSorted(state);
    var wrap = el("div", { class: "stack" }, [
      UI.field({
        label: "شنبه‌ی هفته‌ی جدید (شمسی)",
        name: "startDate",
        value: D.isoToJalaliInput(
          weeks.length ? D.addDays(weeks[weeks.length - 1].startDate, 7) : D.today()
        )
      }),
      el("div", { class: "divider" }),
      templates.length
        ? list
        : UI.empty({ icon: "inbox", title: "الگویی ذخیره نشده است" })
    ]);

    UI.openModal({
      title: "ساخت هفته از الگو",
      body: wrap,
      footer: [UI.button("بستن", { onClick: UI.closeModal })]
    });
  };

  function plannerDay(day, week, ctx) {
    var tasks = Q.tasksOfDay(day.id);
    var ds = S.dayStats(day.id);
    var isOpen = openDays[day.id] !== false; /* open by default */

    var head = el("div", { class: "planner-day__head" }, [
      el(
        "button",
        {
          type: "button",
          class: "btn btn--ghost btn--sm",
          "aria-expanded": isOpen ? "true" : "false",
          onclick: function () {
            openDays[day.id] = !isOpen;
            ctx.rerender();
          }
        },
        [UI.icon("chevronDown"), el("span", { text: isOpen ? "بستن" : "بازکردن" })]
      ),
      el("div", {}, [
        el("div", { class: "planner-day__name", text: D.WEEK_DAYS[day.dowIndex] }),
        el("div", {
          class: "planner-day__summary",
          text:
            D.format(day.date, "long") +
            " · " +
            util.n(tasks.length) +
            " فعالیت · " +
            util.fmtDur(ds.plannedMinutes)
        })
      ]),
      el("div", { style: { flex: "1" } }),
      UI.button("افزودن فعالیت", {
        size: "sm",
        icon: "plus",
        variant: "primary",
        disabled: week.locked,
        onClick: function () {
          K.openTaskEditor(day.id, null);
        }
      }),
      UI.iconButton("note", {
        title: "یادداشت مشاور برای این روز",
        onClick: function () {
          K.openDayNote(day.id);
        }
      })
    ]);

    var children = [head];

    if (isOpen) {
      var body = el("div", { class: "planner-day__body" });

      if (day.consultantNote) {
        body.appendChild(
          UI.noteBlock("یادداشت مشاور", day.consultantNote, "consultant")
        );
        body.appendChild(el("div", { style: { height: "10px" } }));
      }

      if (!tasks.length) {
        body.appendChild(
          UI.empty({
            icon: "inbox",
            title: "برای این روز فعالیتی تعریف نشده است",
            text: "ساخت برنامه‌ی این روز را شروع کنید.",
            action: UI.button("افزودن اولین فعالیت", {
              variant: "primary",
              icon: "plus",
              disabled: week.locked,
              onClick: function () {
                K.openTaskEditor(day.id, null);
              }
            })
          })
        );
      } else {
        tasks.forEach(function (task, index) {
          body.appendChild(plannerTask(task, index, tasks.length, week, ctx));
        });
      }

      children.push(body);
    }

    return el("div", { class: "planner-day" }, children);
  }

  function plannerTask(task, index, total, week, ctx) {
    var color = Q.subjectColor(task.subjectId);
    return el(
      "div",
      { class: "planner-task", style: { "--task-color": color } },
      [
        el("div", { style: { "min-width": "0" } }, [
          el("div", { class: "planner-task__title", text: task.title || "بدون عنوان" }),
          el("div", { class: "planner-task__meta" }, [
            UI.subjectBadge(Q.subjectName(task.subjectId), color),
            UI.badge(util.taskTypeLabel(task.type), "type"),
            el("span", { text: util.fmtDur(task.plannedMinutes) }),
            task.targetQuestions
              ? el("span", { text: util.n(task.targetQuestions) + " تست" })
              : null,
            task.startTime ? el("span", { text: "ساعت " + util.n(task.startTime) }) : null,
            task.priority === "high" ? UI.badge("اولویت زیاد", "priority-high") : null,
            task.topic ? el("span", { class: "text-muted", text: task.topic }) : null
          ])
        ]),
        el("div", { class: "planner-task__actions" }, [
          UI.iconButton("up", {
            title: "انتقال به بالا",
            disabled: index === 0 || week.locked,
            onClick: function () {
              A.moveTask(task.id, -1);
            }
          }),
          UI.iconButton("down", {
            title: "انتقال به پایین",
            disabled: index === total - 1 || week.locked,
            onClick: function () {
              A.moveTask(task.id, 1);
            }
          }),
          UI.iconButton("move", {
            title: "انتقال به روز دیگر",
            disabled: week.locked,
            onClick: function () {
              K.openMoveTask(task.id);
            }
          }),
          UI.iconButton("copy", {
            title: "کپی فعالیت",
            disabled: week.locked,
            onClick: function () {
              A.duplicateTask(task.id);
              UI.toast("فعالیت کپی شد.");
            }
          }),
          UI.iconButton("edit", {
            title: "ویرایش فعالیت",
            disabled: week.locked,
            onClick: function () {
              K.openTaskEditor(task.dayId, task.id);
            }
          }),
          UI.iconButton("trash", {
            title: "حذف فعالیت",
            danger: true,
            disabled: week.locked,
            onClick: function () {
              UI.confirm({
                title: "حذف فعالیت",
                message:
                  "فعالیت «" +
                  util.escapeHtml(task.title) +
                  "» و عملکرد ثبت‌شده‌ی آن حذف می‌شود.",
                danger: true,
                confirmLabel: "حذف"
              }).then(function (ok) {
                if (ok) {
                  A.deleteTask(task.id);
                  UI.toast("فعالیت حذف شد.");
                }
              });
            }
          })
        ])
      ]
    );
  }

  K.openTaskEditor = function (dayId, taskId) {
    var state = HDML.store.get();
    var task = taskId ? state.consultant.tasks[taskId] : null;
    var subjects = Q.activeSubjects(state);

    if (!subjects.length) {
      UI.toast("ابتدا دست‌کم یک درس تعریف کنید.", "danger");
      K.openSubjectEditor(null);
      return;
    }

    var defaults = A.taskDefaults();
    var value = task || defaults;

    var form = el("div", { class: "stack" }, [
      el("div", { class: "form-grid" }, [
        UI.field({
          label: "درس",
          name: "subjectId",
          type: "select",
          required: true,
          value: value.subjectId || subjects[0].id,
          options: subjects.map(function (s) {
            return { value: s.id, label: s.name };
          })
        }),
        UI.field({
          label: "نوع فعالیت",
          name: "type",
          type: "select",
          value: value.type,
          options: HDML.TASK_TYPES.map(function (t) {
            return { value: t.id, label: t.label };
          })
        }),
        UI.field({
          label: "عنوان فعالیت",
          name: "title",
          required: true,
          value: value.title,
          placeholder: "مثلاً: حل ۳۰ تست مشتق",
          full: true
        }),
        UI.field({
          label: "مبحث",
          name: "topic",
          value: value.topic,
          placeholder: "مثلاً: مشتق‌پذیری"
        }),
        UI.field({
          label: "زمان برنامه‌ریزی‌شده (دقیقه)",
          name: "plannedMinutes",
          type: "number",
          min: 0,
          max: 1440,
          required: true,
          controlClass: "input--num",
          value: value.plannedMinutes
        }),
        UI.field({
          label: "تعداد تست هدف",
          name: "targetQuestions",
          type: "number",
          min: 0,
          controlClass: "input--num",
          value: value.targetQuestions || ""
        }),
        UI.field({
          label: "ساعت شروع (اختیاری)",
          name: "startTime",
          type: "time",
          value: value.startTime
        }),
        UI.field({
          label: "اولویت",
          name: "priority",
          type: "select",
          value: value.priority,
          options: HDML.PRIORITIES.map(function (p) {
            return { value: p.id, label: p.label };
          })
        })
      ]),
      UI.field({
        label: "توضیح فعالیت",
        name: "description",
        type: "textarea",
        rows: 2,
        full: true,
        value: value.description,
        placeholder: "مثلاً: صفحات ۴۰ تا ۵۵ کتاب، تمرین‌های فرد"
      }),
      UI.field({
        label: "یادداشت مشاور (به دانش‌آموز نمایش داده می‌شود)",
        name: "consultantNote",
        type: "textarea",
        rows: 2,
        full: true,
        value: value.consultantNote
      })
    ]);

    function collect() {
      return {
        subjectId: UI.valueOf(form, "subjectId"),
        type: UI.valueOf(form, "type"),
        title: UI.valueOf(form, "title").trim(),
        topic: UI.valueOf(form, "topic").trim(),
        plannedMinutes: UI.numberOf(form, "plannedMinutes", 0) || 0,
        targetQuestions: UI.numberOf(form, "targetQuestions", 0) || 0,
        startTime: UI.valueOf(form, "startTime"),
        priority: UI.valueOf(form, "priority"),
        description: UI.valueOf(form, "description"),
        consultantNote: UI.valueOf(form, "consultantNote")
      };
    }

    function validate(data) {
      if (!data.title) return "عنوان فعالیت را وارد کنید.";
      if (!data.subjectId) return "درس فعالیت را انتخاب کنید.";
      if (data.plannedMinutes < 0 || data.plannedMinutes > 1440)
        return "زمان برنامه‌ریزی‌شده باید بین ۰ تا ۱۴۴۰ دقیقه باشد.";
      if (data.targetQuestions < 0) return "تعداد تست نمی‌تواند منفی باشد.";
      return null;
    }

    UI.openModal({
      title: task ? "ویرایش فعالیت" : "افزودن فعالیت",
      subtitle: (function () {
        var day = state.consultant.days[dayId];
        return day ? D.format(day.date, "full") : "";
      })(),
      size: "wide",
      body: form,
      footer: [
        task
          ? el("div", { class: "modal__foot-start" },
              UI.button("کپی", {
                icon: "copy",
                onClick: function () {
                  A.duplicateTask(task.id);
                  UI.closeModal();
                  UI.toast("فعالیت کپی شد.");
                }
              }))
          : null,
        UI.button("انصراف", { onClick: UI.closeModal }),
        !task
          ? UI.button("ذخیره و افزودن بعدی", {
              onClick: function () {
                var data = collect();
                var err = validate(data);
                if (err) {
                  UI.toast(err, "danger");
                  return;
                }
                A.addTask(dayId, data);
                UI.toast("فعالیت افزوده شد.", "success");
                UI.closeModal();
                K.openTaskEditor(dayId, null);
              }
            })
          : null,
        UI.button("ذخیره", {
          variant: "primary",
          icon: "check",
          onClick: function () {
            var data = collect();
            var err = validate(data);
            if (err) {
              UI.toast(err, "danger");
              return;
            }
            if (task) A.updateTask(task.id, data);
            else A.addTask(dayId, data);
            UI.closeModal();
            UI.toast("فعالیت ذخیره شد.", "success");
          }
        })
      ]
    });
  };

  K.openMoveTask = function (taskId) {
    var state = HDML.store.get();
    var task = state.consultant.tasks[taskId];
    if (!task) return;
    var day = state.consultant.days[task.dayId];
    var days = Q.daysOfWeek(day.weekId, state);

    var form = el("div", { class: "stack" }, [
      UI.field({
        label: "انتقال به روز",
        name: "dayId",
        type: "select",
        value: task.dayId,
        options: days.map(function (d) {
          return {
            value: d.id,
            label: D.WEEK_DAYS[d.dowIndex] + " — " + D.format(d.date, "medium")
          };
        })
      })
    ]);

    UI.openModal({
      title: "انتقال فعالیت به روز دیگر",
      size: "narrow",
      body: form,
      footer: [
        UI.button("انصراف", { onClick: UI.closeModal }),
        UI.button("انتقال", {
          variant: "primary",
          icon: "move",
          onClick: function () {
            A.moveTaskToDay(taskId, UI.valueOf(form, "dayId"));
            UI.closeModal();
            UI.toast("فعالیت منتقل شد.", "success");
          }
        })
      ]
    });
  };

  K.openDayNote = function (dayId) {
    var day = HDML.store.get().consultant.days[dayId];
    if (!day) return;
    var form = el("div", { class: "stack" }, [
      UI.field({
        label: "یادداشت مشاور برای این روز",
        name: "note",
        type: "textarea",
        rows: 4,
        full: true,
        value: day.consultantNote || ""
      })
    ]);

    UI.openModal({
      title: "یادداشت روز — " + D.format(day.date, "full"),
      size: "narrow",
      body: form,
      footer: [
        UI.button("انصراف", { onClick: UI.closeModal }),
        UI.button("ذخیره", {
          variant: "primary",
          onClick: function () {
            A.setDayNote(dayId, UI.valueOf(form, "note"));
            UI.closeModal();
            UI.toast("یادداشت ذخیره شد.", "success");
          }
        })
      ]
    });
  };

  function examList(state, ctx) {
    var exams = Q.examsSorted(state);
    if (!exams.length) {
      return UI.empty({
        icon: "exam",
        title: "آزمونی تعریف نشده است",
        text: "آزمون‌های پیش‌رو را تعریف کنید تا دانش‌آموز بتواند نتیجه را ثبت کند."
      });
    }
    return el("div", { class: "table-wrap" }, [
      el("table", { class: "data-table" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { text: "تاریخ" }),
            el("th", { text: "نام" }),
            el("th", { text: "نوع" }),
            el("th", { class: "num-cell", text: "دروس" }),
            el("th", { text: "نتیجه" }),
            el("th", { text: "" })
          ])
        ]),
        el(
          "tbody",
          {},
          exams.map(function (e) {
            var es = S.examStats(e.id, state);
            return el("tr", {}, [
              el("td", { class: "num-cell", text: D.format(e.date, "numeric") }),
              el("td", { class: "cell-subject", text: e.name }),
              el("td", { text: util.examTypeLabel(e.type) }),
              el("td", { class: "num-cell", text: util.n((e.subjectIds || []).length) }),
              el("td", {}, [
                es.hasResult
                  ? UI.badge(util.fmtPct(es.overallPercentage), "success")
                  : UI.badge("بدون نتیجه", "muted")
              ]),
              el("td", {}, [
                el("div", { class: "planner-task__actions" }, [
                  UI.iconButton("edit", {
                    title: "ویرایش آزمون",
                    onClick: function () {
                      HDML.examUI.openExamEditor(e.id);
                    }
                  }),
                  UI.iconButton("eye", {
                    title: "جزئیات",
                    onClick: function () {
                      HDML.examUI.openExamDetails(e.id);
                    }
                  })
                ])
              ])
            ]);
          })
        )
      ])
    ]);
  }
})(typeof window !== "undefined" ? window : globalThis);
