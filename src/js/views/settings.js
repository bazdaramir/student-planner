(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var D = HDML.date;
  var A = HDML.actions;
  var Q = HDML.query;
  var el = UI.el;

  HDML.views = HDML.views || {};

  HDML.views.settings = function (ctx) {
    var state = HDML.store.get();
    var container = el("div", {});

    container.appendChild(
      UI.sectionHead("تنظیمات", "مشخصات، نمایش، و مدیریت اطلاعات", null)
    );

    if (HDML.store.storageError) {
      container.appendChild(
        el(
          "div",
          { class: "view-section" },
          UI.notice(util.escapeHtml(HDML.store.storageError), "danger")
        )
      );
    }

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "مشخصات دانش‌آموز",
          icon: "user",
          actions: UI.button("ویرایش", {
            size: "sm",
            icon: "edit",
            onClick: function () {
              HDML.consultantUI.openProfileEditor();
            }
          }),
          body: el("div", { class: "grid grid--3" }, [
            UI.kv("نام", Q.studentFullName(state)),
            UI.kv("پایه", state.consultant.student.grade || "—"),
            UI.kv("رشته", util.trackLabel(state.consultant.student.track)),
            UI.kv("مشاور", state.consultant.student.consultantName || "—"),
            UI.kv("هدف", state.consultant.student.goal || "—"),
            UI.kv(
              "هفته‌ی جاری",
              (Q.currentWeek(state) && Q.currentWeek(state).title) || "—"
            )
          ])
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "دروس",
          icon: "book",
          hint: util.n(Q.activeSubjects(state).length) + " درس تعریف شده است",
          actions: UI.button("مدیریت در حالت مشاور", {
            size: "sm",
            variant: "ghost",
            onClick: function () {
              ctx.navigate("consultant");
            }
          }),
          body: Q.activeSubjects(state).length
            ? el(
                "div",
                { class: "row" },
                Q.activeSubjects(state).map(function (s) {
                  return UI.subjectBadge(s.name, s.color);
                })
              )
            : UI.empty({ icon: "book", title: "درسی تعریف نشده است" })
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "نمایش",
          icon: "settings",
          body: el("div", { class: "stack" }, [
            el("label", { class: "check-row" }, [
              (function () {
                var cb = el("input", {
                  type: "checkbox",
                  onchange: function (e) {
                    A.setSetting("persianDigits", e.target.checked);
                    UI.toast("تنظیم ذخیره شد.");
                  }
                });
                cb.checked = state.settings.persianDigits !== false;
                return cb;
              })(),
              el("span", { text: "نمایش اعداد به‌صورت فارسی (۱۲۳ به‌جای 123)" })
            ])
          ])
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "اطلاعات و پشتیبان‌گیری",
          icon: "download",
          accent: true,
          body: el("div", { class: "stack" }, [
            UI.notice(
              "اطلاعات این برنامه در حافظه‌ی همین مرورگر ذخیره می‌شود. اگر حافظه‌ی مرورگر پاک شود، اطلاعات از بین می‌رود؛ پس به‌طور منظم پشتیبان بگیرید.",
              "warning"
            ),
            el("div", { class: "btn-row" }, [
              UI.button("خروجی عملکرد (JSON)", {
                icon: "download",
                variant: "primary",
                onClick: function () {
                  HDML.transfer.exportActivity();
                }
              }),
              UI.button("پشتیبان کامل", {
                icon: "download",
                onClick: function () {
                  HDML.transfer.exportBackup();
                }
              }),
              UI.button("بازیابی از پشتیبان", {
                icon: "upload",
                onClick: function () {
                  HDML.transfer.openImportDialog("backup");
                }
              }),
              UI.button("ورود عملکرد", {
                icon: "upload",
                onClick: function () {
                  HDML.transfer.openImportDialog("activity");
                }
              })
            ]),
            el("div", { class: "divider" }),
            el("div", { class: "grid grid--3" }, [
              UI.kv("آخرین تغییر", String(state.meta.updatedAt || "").slice(0, 10)),
              UI.kv("نسخه‌ی برنامه", HDML.VERSION),
              UI.kv(
                "حجم تقریبی",
                util.n(Math.round(JSON.stringify(state).length / 1024)) + " کیلوبایت"
              )
            ])
          ])
        })
      ])
    );

    if (state.meta.exportedForStudent) {
      container.appendChild(
        el("div", { class: "view-section" }, [
          UI.card({
            title: "حالت مشاور",
            icon: "consultant",
            body: el("div", { class: "stack" }, [
              UI.notice(
                "این فایل برای دانش‌آموز ساخته شده و «حالت مشاور» از منو پنهان است تا برنامه به‌طور تصادفی تغییر نکند.",
                "info"
              ),
              state.ui.consultantUnlocked
                ? UI.button("پنهان‌کردن دوباره‌ی حالت مشاور", {
                    icon: "lock",
                    onClick: function () {
                      A.setUi({ consultantUnlocked: false });
                      UI.toast("حالت مشاور پنهان شد.");
                    }
                  })
                : UI.button("بازکردن حالت مشاور", {
                    icon: "unlock",
                    variant: "gold",
                    onClick: function () {
                      UI.confirm({
                        title: "بازکردن حالت مشاور",
                        message:
                          "با بازکردن این بخش می‌توانید برنامه را ویرایش کنید. تغییر برنامه پس از شروع هفته می‌تواند آمار را جابه‌جا کند.",
                        confirmLabel: "باز کن"
                      }).then(function (ok) {
                        if (ok) {
                          A.setUi({ consultantUnlocked: true });
                          UI.toast("حالت مشاور فعال شد.", "success");
                        }
                      });
                    }
                  })
            ])
          })
        ])
      );
    }

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "داده‌ی نمونه و بازنشانی",
          icon: "alert",
          body: el("div", { class: "stack" }, [
            state.meta.isDemo
              ? UI.notice(
                  "در حال حاضر <strong>داده‌ی نمونه</strong> بارگذاری شده است. برای شروع کار واقعی، اطلاعات را بازنشانی کنید.",
                  "warning"
                )
              : null,
            el("div", { class: "btn-row" }, [
              UI.button("بارگذاری داده‌ی نمونه", {
                icon: "sparkle",
                onClick: function () {
                  UI.confirm({
                    title: "بارگذاری داده‌ی نمونه",
                    message:
                      "یک دانش‌آموز نمونه با دو هفته برنامه، عملکرد ثبت‌شده و چند آزمون جایگزین اطلاعات فعلی می‌شود.",
                    detail: "همه‌ی اطلاعات فعلی پاک خواهد شد. اگر لازم است، ابتدا پشتیبان بگیرید.",
                    danger: true,
                    confirmLabel: "بارگذاری نمونه"
                  }).then(function (ok) {
                    if (ok) {
                      HDML.demo.load();
                      UI.toast("داده‌ی نمونه بارگذاری شد.", "success");
                      ctx.navigate("dashboard");
                    }
                  });
                }
              }),
              UI.button("پاک‌کردن فقط عملکرد", {
                icon: "refresh",
                onClick: function () {
                  UI.confirm({
                    title: "پاک‌کردن عملکرد",
                    message:
                      "همه‌ی زمان‌ها، تست‌ها، یادداشت‌های دانش‌آموز و نتایج آزمون پاک می‌شود. برنامه‌ی مشاور دست‌نخورده می‌ماند.",
                    danger: true,
                    confirmLabel: "پاک کن"
                  }).then(function (ok) {
                    if (!ok) return;
                    HDML.store.mutate(function (st) {
                      st.student = {
                        taskLogs: {},
                        timers: {},
                        dailyNotes: {},
                        weeklyReflections: {},
                        examResults: {}
                      };
                    });
                    UI.toast("عملکرد پاک شد.");
                  });
                }
              }),
              UI.button("بازنشانی کامل", {
                icon: "trash",
                variant: "danger-ghost",
                onClick: function () {
                  UI.confirm({
                    title: "بازنشانی کامل اطلاعات",
                    message:
                      "همه‌ی اطلاعات این برنامه — برنامه‌ی مشاور، عملکرد، آزمون‌ها و یادداشت‌ها — برای همیشه پاک می‌شود.",
                    detail:
                      "این عمل قابل بازگشت نیست. اگر ممکن است بعداً به این اطلاعات نیاز داشته باشید، ابتدا «پشتیبان کامل» بگیرید.",
                    danger: true,
                    confirmLabel: "بله، همه‌چیز پاک شود"
                  }).then(function (ok) {
                    if (!ok) return;
                    UI.confirm({
                      title: "تأیید نهایی",
                      message: "مطمئن هستید؟ این آخرین فرصت برای انصراف است.",
                      danger: true,
                      confirmLabel: "پاک کن"
                    }).then(function (sure) {
                      if (!sure) return;
                      HDML.store.clearStored();
                      var fresh = HDML.defaultState();
                      HDML.store.replace(fresh);
                      UI.toast("اطلاعات بازنشانی شد.");
                      ctx.navigate("consultant");
                    });
                  });
                }
              })
            ])
          ])
        })
      ])
    );

    container.appendChild(
      el("div", { class: "view-section" }, [
        UI.card({
          title: "درباره",
          icon: "info",
          body: el("div", { class: "stack" }, [
            el("p", {
              class: "text-sm",
              text:
                "این برنامه یک فایل HTML مستقل است: بدون سرور، بدون پایگاه‌داده و بدون نیاز به اینترنت کار می‌کند. مشاور برنامه را می‌سازد و خروجی می‌گیرد؛ دانش‌آموز همان فایل را باز می‌کند، عملکردش را ثبت می‌کند و فایل عملکرد را برای مشاور می‌فرستد."
            }),
            el("div", { class: "grid grid--3" }, [
              UI.kv("نسخه", HDML.VERSION),
              UI.kv("نسخه‌ی ساختار داده", String(HDML.SCHEMA_VERSION)),
              UI.kv("امروز", D.format(D.today(), "full"))
            ])
          ])
        })
      ])
    );

    return container;
  };
})(typeof window !== "undefined" ? window : globalThis);
