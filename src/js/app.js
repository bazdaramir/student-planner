(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var UI = HDML.ui;
  var D = HDML.date;
  var A = HDML.actions;
  var Q = HDML.query;
  var el = UI.el;
  var doc = global.document;

  /* Five sections. That is the whole app as far as the student is concerned;
     everything else lives behind the menu button. */
  var NAV = [
    { id: "today", label: "امروز", emoji: "🏠" },
    { id: "week", label: "هفته", emoji: "📅" },
    { id: "progress", label: "پیشرفت", emoji: "📊" },
    { id: "exams", label: "آزمون‌ها", emoji: "📝" },
    { id: "reports", label: "گزارش", emoji: "📤" }
  ];

  /* Reachable from the menu, never from the main navigation. */
  var HIDDEN_VIEWS = ["dashboard", "consultant", "settings"];

  var app = {
    currentView: "dashboard",
    params: null,
    root: null,
    contentNode: null
  };

  HDML.app = app;

  function visibleNav() {
    return NAV;
  }

  function isKnownView(viewId) {
    return (
      NAV.some(function (n) {
        return n.id === viewId;
      }) || HIDDEN_VIEWS.indexOf(viewId) >= 0
    );
  }

  function navigate(viewId, params) {
    app.currentView = isKnownView(viewId) ? viewId : "today";
    app.params = params || null;
    A.setUi({ view: app.currentView });
    closeDrawer();
    render();
    if (app.contentNode) app.contentNode.scrollIntoView({ block: "start" });
    global.scrollTo(0, 0);
  }

  app.navigate = navigate;

  function buildShell() {
    var sidebar = el("aside", { class: "sidebar", id: "sidebar" });
    var topbar = el("header", { class: "topbar" });
    var content = el("main", { class: "content", id: "main-content", tabindex: "-1" });
    var bottomNav = el("nav", { class: "bottom-nav", "aria-label": "ناوبری اصلی" });
    var backdrop = el("div", {
      class: "drawer-backdrop",
      onclick: closeDrawer
    });

    var main = el("div", { class: "main" }, [topbar, content]);
    var shell = el("div", { class: "app", id: "app-shell" }, [
      sidebar,
      main,
      backdrop,
      bottomNav
    ]);

    app.root = shell;
    app.sidebar = sidebar;
    app.topbar = topbar;
    app.contentNode = content;
    app.bottomNav = bottomNav;
    return shell;
  }

  function renderSidebar() {
    var state = HDML.store.get();

    UI.replace(app.sidebar, [
      el("div", { class: "sidebar__brand" }, [
        el("img", { class: "sidebar__logo", src: HDML.LOGO, alt: "لوگو انیگما" }),
        el("div", {}, [
          el("div", { class: "sidebar__title", text: "ENIGMA" }),
          el("div", { class: "sidebar__subtitle", text: "برنامه‌ی مطالعه‌ی من" })
        ])
      ]),
      el("div", { class: "sidebar__student" }, [
        el("div", { class: "sidebar__student-name", text: Q.studentFullName(state) }),
        (function () {
          var week = Q.currentWeek(state);
          return week
            ? el("div", { class: "sidebar__student-meta", text: week.title })
            : null;
        })()
      ]),
      el(
        "nav",
        { class: "sidebar__nav", "aria-label": "منوی اصلی" },
        NAV.map(function (item) {
          return navButton(item, "nav-item");
        })
      ),
      el("div", { class: "sidebar__footer" }, [
        UI.button("منو", {
          icon: "menu",
          block: true,
          onClick: openMenu
        }),
        state.meta.isDemo
          ? el("div", { class: "mode-chip", style: { "margin-top": "10px" } }, "داده‌ی نمونه")
          : null
      ])
    ]);
  }

  function navButton(item, className) {
    var isActive = app.currentView === item.id;
    var badge = null;

    if (item.id === "today") {
      var todayStats = HDML.stats.dayStatsByDate(D.today());
      if (todayStats) {
        var remaining = todayStats.pendingTasks + todayStats.inProgressTasks;
        if (remaining > 0) {
          badge = el("span", { class: "nav-item__badge", text: util.n(remaining) });
        }
      }
    }

    return el(
      "button",
      {
        type: "button",
        class: className,
        "aria-current": isActive ? "page" : null,
        onclick: function () {
          navigate(item.id);
        }
      },
      [
        el("span", { class: "nav-emoji", text: item.emoji }),
        el("span", { text: item.label }),
        badge
      ]
    );
  }

  function renderBottomNav() {
    UI.replace(
      app.bottomNav,
      NAV.map(function (item) {
        return el(
          "button",
          {
            type: "button",
            class: "bottom-nav__item",
            "aria-current": app.currentView === item.id ? "page" : null,
            onclick: function () {
              navigate(item.id);
            }
          },
          [el("span", { class: "nav-emoji", text: item.emoji }), el("span", { text: item.label })]
        );
      })
    );
  }

  function renderTopbar() {
    var state = HDML.store.get();
    var item = NAV.filter(function (n) {
      return n.id === app.currentView;
    })[0];
    var runningId = A.runningTaskId();

    UI.replace(app.topbar, [
      el(
        "button",
        {
          class: "hamburger",
          type: "button",
          "aria-label": "منو",
          onclick: openMenu
        },
        UI.icon("menu")
      ),
      el("img", {
        src: HDML.LOGO,
        alt: "",
        class: "topbar__logo",
        style: { width: "30px", height: "30px", "object-fit": "contain" }
      }),
      el("div", { style: { "min-width": "0" } }, [
        el("div", {
          class: "topbar__title",
          text: item ? item.label : "ENIGMA"
        }),
        el("div", { class: "topbar__sub", text: Q.studentFullName(state) })
      ]),
      el("div", { class: "topbar__spacer" }),
      el("div", { class: "topbar__actions no-print" }, [
        runningId
          ? el(
              "div",
              { class: "timer-pill", dataset: { timerFor: runningId } },
              [
                el("span", { class: "timer-pill__dot" }),
                el("span", {
                  class: "timer-value",
                  text: HDML.taskUI.formatClock(A.timerMinutes(runningId))
                })
              ]
            )
          : null,
        UI.iconButton("menu", { title: "منو", onClick: openMenu })
      ])
    ]);
  }

  /** Everything that is not day-to-day studying lives here. */
  function openMenu() {
    closeDrawer();
    var state = HDML.store.get();

    function item(emoji, label, hint, onClick) {
      return el(
        "button",
        {
          type: "button",
          class: "menu-item",
          onclick: function () {
            UI.closeModal();
            setTimeout(onClick, 60);
          }
        },
        [
          el("span", { class: "menu-item__emoji", text: emoji }),
          el("span", {}, [
            el("div", { class: "menu-item__label", text: label }),
            hint ? el("div", { class: "menu-item__hint", text: hint }) : null
          ])
        ]
      );
    }

    UI.openModal({
      title: "منو",
      body: el("div", { class: "menu-list" }, [
        item("📥", "دریافت برنامه جدید", "فایل JSON که مشاورت فرستاده", function () {
          HDML.weekImport.openDialog();
        }),
        item("💾", "ذخیره و دریافت فایل جدید", "یک فایل HTML با همه‌ی اطلاعاتت", function () {
          HDML.transfer.exportStudentHtml();
        }),
        item("📊", "خلاصه‌ی کلی", "نمای کلی هفته", function () {
          navigate("dashboard");
        }),
        item("⚙️", "تنظیمات", "نام، دروس، پشتیبان‌گیری", function () {
          navigate("settings");
        }),
        item("🧑‍🏫", "حالت مشاور", "ساخت و ویرایش برنامه", function () {
          navigate("consultant");
        })
      ]),
      footer: [
        el("div", { class: "modal__foot-start text-xs text-muted" }, [
          el("span", { text: "ENIGMA نسخه " + util.n(HDML.VERSION) })
        ]),
        UI.button("بستن", { onClick: UI.closeModal })
      ]
    });
  }

  app.openMenu = openMenu;

  function openDrawer() {
    app.root.classList.add("is-drawer-open");
  }

  function closeDrawer() {
    app.root.classList.remove("is-drawer-open");
  }

  var renderScheduled = false;

  function render() {
    renderSidebar();
    renderTopbar();
    renderBottomNav();

    var view = HDML.views[app.currentView];
    UI.clear(app.contentNode);

    if (!view) {
      app.contentNode.appendChild(
        UI.empty({ title: "این صفحه پیدا نشد", icon: "alert" })
      );
      return;
    }

    try {
      var node = view({
        navigate: navigate,
        rerender: render,
        params: app.params
      });
      app.params = null;
      app.contentNode.appendChild(node);
    } catch (err) {
      if (global.console) console.error(err);
      app.contentNode.appendChild(
        UI.notice(
          "خطایی در نمایش این صفحه رخ داد: " +
            util.escapeHtml(err && err.message ? err.message : String(err)) +
            "<br>اگر مشکل ادامه داشت، از داده‌ها پشتیبان بگیرید و صفحه را دوباره باز کنید.",
          "danger"
        )
      );
    }
  }

  app.render = render;

  /* setTimeout, not requestAnimationFrame: a hidden or background tab never
     runs rAF callbacks, which would leave the view stale after a mutation. */
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    setTimeout(function () {
      renderScheduled = false;
      render();
    }, 0);
  }

  /**
   * Charts size their viewBox to the viewport so labels stay readable. When
   * the phone rotates (or a window is resized across a breakpoint) they must
   * be redrawn at the new size.
   */
  function startViewportWatch() {
    var lastBucket = HDML.charts.metrics().W;

    var onResize = util.debounce(function () {
      var bucket = HDML.charts.metrics().W;
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        render();
      }
    }, 220);

    global.addEventListener("resize", onResize);
    global.addEventListener("orientationchange", function () {
      /* iOS reports the old size during the event itself. */
      setTimeout(onResize, 260);
    });
  }

  /**
   * Updates only the running clock text once per second. A full re-render
   * every second would be wasteful and would fight with open inputs.
   */
  function startTicker() {
    setInterval(function () {
      var runningId = A.runningTaskId();
      if (!runningId) return;
      var minutes = A.timerMinutes(runningId);
      var text = HDML.taskUI.formatClock(minutes);
      var nodes = doc.querySelectorAll(
        '[data-timer-for="' + runningId + '"] .timer-value'
      );
      for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text;
    }, 1000);

    /* Persist a running timer before the page goes away so the elapsed time
       is not lost on refresh or close. */
    global.addEventListener("beforeunload", function () {
      var runningId = A.runningTaskId();
      if (runningId) HDML.store.persistNow();
    });
  }

  /**
   * If the page was closed while a timer ran, the elapsed wall-clock time is
   * still recoverable from `startedAt`. Ask instead of silently guessing.
   */
  function handleRecoveredTimer() {
    var state = HDML.store.get();
    var runningId = A.runningTaskId();
    if (!runningId) return;
    var timer = state.student.timers[runningId];
    var task = state.consultant.tasks[runningId];
    if (!timer || !task) return;

    var minutes = Math.max(0, (Date.now() - timer.running.startedAt) / 60000);
    if (minutes < 1) return;

    UI.openModal({
      title: "کرنومتر در حال اجرا بود",
      size: "narrow",
      dismissible: false,
      body: el("div", { class: "stack" }, [
        UI.notice(
          "هنگام بستن صفحه، کرنومتر فعالیت «<strong>" +
            util.escapeHtml(task.title) +
            "</strong>» در حال اجرا بود.",
          "warning"
        ),
        UI.kv("زمان سپری‌شده از آن لحظه", util.fmtDur(minutes)),
        el("p", {
          class: "text-sm text-muted",
          text: "آیا این زمان به‌عنوان مطالعه ثبت شود؟"
        })
      ]),
      footer: [
        UI.button("نه، دور بریز", {
          onClick: function () {
            HDML.store.mutate(function (st) {
              if (st.student.timers[runningId]) {
                st.student.timers[runningId].running = null;
              }
            });
            UI.closeModal();
          }
        }),
        UI.button("بله، ثبت کن", {
          variant: "primary",
          onClick: function () {
            A.stopTimer(runningId);
            UI.closeModal();
            UI.toast("زمان ثبت شد.", "success");
          }
        })
      ]
    });
  }

  function offerPlanUpdate() {
    var pending = HDML.store.pendingPlan;
    if (!pending) return;
    var incomingWeeks = Object.keys(pending.consultant.weeks).length;
    var incomingTasks = Object.keys(pending.consultant.tasks).length;

    UI.openModal({
      title: "برنامه‌ی جدیدی در این فایل هست",
      dismissible: false,
      body: el("div", { class: "stack" }, [
        UI.notice(
          "این فایل شامل برنامه‌ی به‌روزتری نسبت به اطلاعات ذخیره‌شده در این مرورگر است. می‌توانید برنامه را به‌روز کنید؛ <strong>عملکرد ثبت‌شده‌ی شما حفظ می‌شود</strong>.",
          "info"
        ),
        el("div", { class: "card" }, [
          el("div", { class: "card__body" }, [
            UI.kv("تعداد هفته در فایل", util.n(incomingWeeks)),
            UI.kv("تعداد فعالیت در فایل", util.n(incomingTasks)),
            UI.kv(
              "تاریخ برنامه‌ی فایل",
              String(pending.meta.planStamp || "").slice(0, 10)
            )
          ])
        ])
      ]),
      footer: [
        UI.button("فعلاً نه", {
          onClick: function () {
            HDML.store.pendingPlan = null;
            UI.closeModal();
          }
        }),
        UI.button("پشتیبان بگیر", {
          icon: "download",
          onClick: function () {
            HDML.transfer.exportBackup();
          }
        }),
        UI.button("برنامه را به‌روز کن", {
          variant: "primary",
          icon: "refresh",
          onClick: function () {
            HDML.store.adoptPlan(pending);
            UI.closeModal();
            UI.toast("برنامه‌ی جدید اعمال شد.", "success");
          }
        })
      ]
    });
  }

  function readEmbeddedPayload() {
    var node = doc.getElementById("hdml-data");
    if (!node) return null;
    var raw = (node.textContent || "").trim();
    if (!raw || raw === "null") return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      if (global.console) console.error("embedded payload is not valid JSON", err);
      return null;
    }
  }

  function boot() {
    var mountPoint = doc.getElementById("app-root");
    if (!mountPoint) return;

    /* The static fallback in the HTML is only a placeholder; the real app
       replaces it. If we crash before this point the fallback stays on
       screen, which is the whole point of it being there. */
    var fallback = doc.getElementById("boot-fallback");

    var embedded = readEmbeddedPayload();
    var result = HDML.store.boot(embedded);

    var state = HDML.store.get();
    util.usePersianDigits = state.settings.persianDigits !== false;

    /* Always open on "امروز". Opening the file should always answer the same
       question first: what do I have to do today? */
    app.currentView = "today";

    if (fallback && fallback.parentNode) fallback.parentNode.removeChild(fallback);
    mountPoint.appendChild(buildShell());
    HDML.store.subscribe(scheduleRender);
    render();
    startTicker();

    if (!HDML.store.isStorageAvailable()) {
      UI.toast(
        "حافظه‌ی مرورگر در دسترس نیست؛ اطلاعات ذخیره نمی‌شود. لطفاً خروجی پشتیبان بگیرید.",
        "danger",
        8000
      );
    }

    if (result.newerPlanInFile) {
      setTimeout(offerPlanUpdate, 400);
    } else {
      setTimeout(handleRecoveredTimer, 400);
    }

    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !UI.isModalOpen()) closeDrawer();
    });

    startViewportWatch();
  }

  /**
   * Any exception here would otherwise leave the page showing only the static
   * fallback with no explanation. Surface it through the error boundary.
   */
  function safeBoot() {
    try {
      boot();
    } catch (err) {
      if (global.console) console.error("boot failed", err);
      if (typeof global.__enigmaFail === "function") {
        global.__enigmaFail("Boot", (err && err.message) || String(err));
      }
    }
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", safeBoot);
  } else {
    safeBoot();
  }
})(typeof window !== "undefined" ? window : globalThis);
