(function (global) {
  "use strict";

  var HDML = (global.HDML = global.HDML || {});
  var util = HDML.util;
  var UI = (HDML.ui = {});

  var doc = global.document;

  /**
   * Tiny DOM builder.
   *   el('div', { class:'card', onclick: fn, text:'hi' }, [child, child])
   * `html` is only ever used with content we generated ourselves.
   */
  function el(tag, attrs, children) {
    var node = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "class" || key === "className") {
          node.className = value;
        } else if (key === "text") {
          node.textContent = value;
        } else if (key === "html") {
          node.innerHTML = value;
        } else if (key === "style" && util.isObject(value)) {
          Object.keys(value).forEach(function (p) {
            node.style.setProperty(p, value[p]);
          });
        } else if (key === "dataset" && util.isObject(value)) {
          Object.keys(value).forEach(function (p) {
            node.dataset[p] = value[p];
          });
        } else if (key.slice(0, 2) === "on" && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) {
          node.setAttribute(key, "");
        } else {
          node.setAttribute(key, value);
        }
      });
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) {
      children.forEach(function (c) {
        appendChildren(node, c);
      });
      return;
    }
    if (children instanceof global.Node) {
      node.appendChild(children);
      return;
    }
    if (children === false) return;
    node.appendChild(doc.createTextNode(String(children)));
  }

  UI.el = el;

  UI.frag = function (children) {
    var f = doc.createDocumentFragment();
    appendChildren(f, children);
    return f;
  };

  UI.clear = function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  UI.replace = function (node, children) {
    UI.clear(node);
    appendChildren(node, children);
    return node;
  };

  var ICON_PATHS = {
    dashboard: "M3 12h7V3H3zM14 21h7v-9h-7zM14 8h7V3h-7zM3 21h7v-6H3z",
    today:
      "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 15l2 2 4-4",
    week: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
    exam:
      "M9 3h6a1 1 0 011 1v1H8V4a1 1 0 011-1zM6 5h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2zM9 12h6M9 16h4",
    progress: "M3 21h18M7 21V10M12 21V4M17 21v-7",
    report:
      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5",
    consultant:
      "M4 6h16M4 12h16M4 18h16M9 3v6M15 9v6M7 15v6",
    settings:
      "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    edit: "M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5z",
    trash: "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6",
    copy: "M9 9h10a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V11a2 2 0 012-2zM5 15H4a2 2 0 01-2-2V3a2 2 0 012-2h10a2 2 0 012 2v1",
    up: "M12 19V5M5 12l7-7 7 7",
    down: "M12 5v14M19 12l-7 7-7-7",
    move: "M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20",
    play: "M6 3l14 9-14 9z",
    pause: "M8 4h3v16H8zM13 4h3v16h-3z",
    stop: "M6 6h12v12H6z",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18M6 6l12 12",
    chevronDown: "M6 9l6 6 6-6",
    chevronLeft: "M15 18l-6-6 6-6",
    chevronRight: "M9 18l6-6-6-6",
    download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
    upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
    printer:
      "M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z",
    clock: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
    target:
      "M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
    book: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
    alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z",
    info: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01",
    menu: "M3 12h18M3 6h18M3 18h18",
    refresh: "M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15",
    lock: "M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM7 11V7a5 5 0 0110 0v4",
    unlock: "M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM7 11V7a5 5 0 019.9-1",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z",
    user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
    note: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h6M8 17h4",
    skip: "M12 22a10 10 0 100-20 10 10 0 000 20zM8 12h8",
    sparkle: "M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z",
    inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z",
    filter: "M22 3H2l8 9.5V19l4 2v-8.5z"
  };

  /**
   * @param {string} name key of ICON_PATHS
   * @param {number} [size] px, default 20
   */
  UI.icon = function (name, size) {
    var path = ICON_PATHS[name] || ICON_PATHS.info;
    var svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (size) {
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);
    }
    var p = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
    return svg;
  };

  UI.hasIcon = function (name) {
    return !!ICON_PATHS[name];
  };

  UI.button = function (label, opts) {
    var o = opts || {};
    var classes = ["btn"];
    if (o.variant) classes.push("btn--" + o.variant);
    if (o.size) classes.push("btn--" + o.size);
    if (o.block) classes.push("btn--block");
    if (o.class) classes.push(o.class);
    return el(
      "button",
      {
        type: o.type || "button",
        class: classes.join(" "),
        onclick: o.onClick,
        disabled: o.disabled,
        title: o.title || null,
        "aria-label": o.ariaLabel || null
      },
      [o.icon ? UI.icon(o.icon) : null, label ? el("span", { text: label }) : null]
    );
  };

  UI.iconButton = function (iconName, opts) {
    var o = opts || {};
    return el(
      "button",
      {
        type: "button",
        class: "icon-btn" + (o.danger ? " icon-btn--danger" : ""),
        onclick: o.onClick,
        title: o.title || "",
        "aria-label": o.title || iconName,
        disabled: o.disabled
      },
      UI.icon(iconName)
    );
  };

  UI.badge = function (text, variant, opts) {
    var o = opts || {};
    return el("span", {
      class: "badge badge--" + (variant || "muted"),
      text: text,
      style: o.color ? { "--badge-color": o.color } : null,
      title: o.title || null
    });
  };

  UI.subjectBadge = function (name, color) {
    return el("span", {
      class: "badge badge--subject",
      text: name,
      style: { "--badge-color": color || "#9aa4bb" }
    });
  };

  UI.meter = function (rate, opts) {
    var o = opts || {};
    var tone = o.tone || util.rateTone(rate);
    var width = rate === null ? 0 : util.clamp(rate, 0, 100);
    return el(
      "div",
      {
        class: "meter" + (o.large ? " meter--lg" : ""),
        role: "img",
        "aria-label":
          (o.label || "میزان تحقق") + ": " + (rate === null ? "بدون داده" : util.fmtPct(rate))
      },
      el("div", {
        class: "meter__fill meter__fill--" + tone,
        style: { width: width + "%" }
      })
    );
  };

  UI.kpi = function (config) {
    var children = [
      el("div", { class: "kpi__label" }, [
        config.icon ? UI.icon(config.icon, 14) : null,
        el("span", { text: config.label })
      ]),
      el("div", { class: "kpi__value" }, [
        config.value,
        config.unit ? el("small", { text: " " + config.unit }) : null
      ])
    ];
    if (config.rate !== undefined) {
      children.push(UI.meter(config.rate, { label: config.label }));
    }
    if (config.foot) {
      children.push(el("div", { class: "kpi__foot" }, config.foot));
    }
    return el(
      "div",
      { class: "kpi" + (config.gold ? " kpi--gold" : "") },
      children
    );
  };

  UI.card = function (config) {
    var head = null;
    if (config.title || config.actions) {
      head = el("div", { class: "card__head" }, [
        config.icon ? UI.icon(config.icon, 18) : null,
        el("div", {}, [
          el("h3", { text: config.title || "" }),
          config.hint ? el("div", { class: "card__hint", text: config.hint }) : null
        ]),
        el("div", { class: "card__spacer" }),
        config.actions || null
      ]);
    }
    return el(
      "section",
      { class: "card" + (config.accent ? " card--accent" : "") + (config.class ? " " + config.class : "") },
      [
        head,
        el(
          "div",
          { class: "card__body" + (config.flush ? " card__body--flush" : "") },
          config.body
        )
      ]
    );
  };

  UI.empty = function (config) {
    return el("div", { class: "empty" }, [
      el("div", { class: "empty__icon" }, UI.icon(config.icon || "inbox", 48)),
      el("div", { class: "empty__title", text: config.title }),
      config.text ? el("p", { class: "empty__text", text: config.text }) : null,
      config.action || null
    ]);
  };

  UI.notice = function (text, variant, extra) {
    var iconName =
      variant === "danger" || variant === "warning" ? "alert" : "info";
    return el("div", { class: "notice notice--" + (variant || "info") }, [
      UI.icon(iconName, 18),
      el("div", {}, [el("div", { html: text }), extra || null])
    ]);
  };

  UI.field = function (config) {
    var id = config.id || util.uid("f");
    var control;
    var common = {
      id: id,
      class: config.controlClass || "",
      name: config.name || id,
      disabled: config.disabled,
      "aria-invalid": config.invalid ? "true" : null,
      "aria-describedby": config.error ? id + "-err" : null
    };

    if (config.type === "textarea") {
      control = el(
        "textarea",
        Object.assign(common, {
          class: "textarea " + (config.controlClass || ""),
          rows: config.rows || 3,
          placeholder: config.placeholder || "",
          oninput: config.onInput,
          onchange: config.onChange
        })
      );
      control.value = config.value || "";
    } else if (config.type === "select") {
      control = el(
        "select",
        Object.assign(common, {
          class: "select " + (config.controlClass || ""),
          onchange: config.onChange
        }),
        (config.options || []).map(function (o) {
          return el("option", { value: o.value, text: o.label });
        })
      );
      control.value = config.value == null ? "" : String(config.value);
    } else {
      control = el(
        "input",
        Object.assign(common, {
          class: "input " + (config.controlClass || ""),
          type: config.type || "text",
          placeholder: config.placeholder || "",
          min: config.min,
          max: config.max,
          step: config.step,
          inputmode: config.inputmode,
          oninput: config.onInput,
          onchange: config.onChange
        })
      );
      control.value = config.value == null ? "" : String(config.value);
    }

    return el(
      "div",
      { class: "field" + (config.full ? " field--full" : "") },
      [
        el("label", { class: "field__label", for: id }, [
          config.label,
          config.required ? el("span", { class: "req", text: "*" }) : null
        ]),
        control,
        config.hint ? el("div", { class: "field__hint", text: config.hint }) : null,
        config.error
          ? el("div", { class: "field__error", id: id + "-err", text: config.error })
          : null
      ]
    );
  };

  /** Reads a value out of a field built by UI.field. */
  UI.valueOf = function (root, name) {
    var node = root.querySelector('[name="' + name + '"]');
    return node ? node.value : "";
  };

  UI.numberOf = function (root, name, fallback) {
    var raw = util.enDigits(UI.valueOf(root, name)).trim();
    if (raw === "") return fallback === undefined ? null : fallback;
    var n = Number(raw);
    return isFinite(n) ? n : fallback === undefined ? null : fallback;
  };

  var modalRoot = null;
  var modalStack = [];
  var lastFocused = null;

  function ensureModalRoot() {
    if (!modalRoot) {
      modalRoot = doc.getElementById("modal-root");
    }
    return modalRoot;
  }

  function trapFocus(e) {
    if (!modalStack.length) return;
    var top = modalStack[modalStack.length - 1];
    if (e.key === "Escape") {
      e.preventDefault();
      if (top.dismissible !== false) UI.closeModal();
      return;
    }
    if (e.key !== "Tab") return;
    var focusables = top.node.querySelectorAll(
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /**
   * @param {{title:string, subtitle?:string, body:Node|Node[], footer?:Node[],
   *          size?:'wide'|'narrow', dismissible?:boolean, onClose?:function}} config
   */
  UI.openModal = function (config) {
    var root = ensureModalRoot();
    if (!root) return null;

    if (!modalStack.length) {
      lastFocused = doc.activeElement;
      doc.addEventListener("keydown", trapFocus, true);
      doc.body.style.overflow = "hidden";
    }

    var titleId = util.uid("mt");
    var modal = el(
      "div",
      {
        class:
          "modal" + (config.size ? " modal--" + config.size : ""),
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": titleId
      },
      [
        el("div", { class: "modal__head" }, [
          el("div", { class: "modal__title", id: titleId }, [
            config.title,
            config.subtitle
              ? el("div", { class: "modal__subtitle", text: config.subtitle })
              : null
          ]),
          config.dismissible === false
            ? null
            : UI.iconButton("x", {
                title: "بستن",
                onClick: function () {
                  UI.closeModal();
                }
              })
        ]),
        el("div", { class: "modal__body" }, config.body),
        config.footer ? el("div", { class: "modal__foot" }, config.footer) : null
      ]
    );

    var backdrop = el("div", {
      class: "modal__backdrop",
      onclick: function () {
        if (config.dismissible !== false) UI.closeModal();
      }
    });

    /* Positioning lives in CSS so the mobile bottom-sheet rules can win;
       inline styles here would override them. */
    var layer = el("div", { class: "modal-layer" }, [backdrop, modal]);

    root.hidden = false;
    root.appendChild(layer);

    var entry = {
      node: modal,
      layer: layer,
      onClose: config.onClose,
      dismissible: config.dismissible
    };
    modalStack.push(entry);

    setTimeout(function () {
      var target =
        modal.querySelector("[data-autofocus]") ||
        modal.querySelector("input,textarea,select,button");
      if (target) target.focus();
    }, 30);

    return { modal: modal, close: UI.closeModal };
  };

  UI.closeModal = function () {
    var entry = modalStack.pop();
    if (!entry) return;
    if (entry.layer.parentNode) entry.layer.parentNode.removeChild(entry.layer);
    if (typeof entry.onClose === "function") entry.onClose();
    if (!modalStack.length) {
      var root = ensureModalRoot();
      if (root) root.hidden = true;
      doc.removeEventListener("keydown", trapFocus, true);
      doc.body.style.overflow = "";
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      lastFocused = null;
    }
  };

  UI.closeAllModals = function () {
    while (modalStack.length) UI.closeModal();
  };

  UI.isModalOpen = function () {
    return modalStack.length > 0;
  };

  /**
   * @returns {Promise<boolean>}
   */
  UI.confirm = function (config) {
    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }
      UI.openModal({
        title: config.title,
        size: "narrow",
        body: [
          el("p", { class: "text-sm", html: config.message }),
          config.detail
            ? UI.notice(config.detail, config.danger ? "danger" : "info")
            : null
        ],
        footer: [
          UI.button(config.cancelLabel || "انصراف", {
            onClick: function () {
              done(false);
              UI.closeModal();
            }
          }),
          UI.button(config.confirmLabel || "تأیید", {
            variant: config.danger ? "danger-ghost" : "primary",
            onClick: function () {
              done(true);
              UI.closeModal();
            }
          })
        ],
        onClose: function () {
          done(false);
        }
      });
    });
  };

  UI.toast = function (message, variant, ms) {
    var root = doc.getElementById("toast-root");
    if (!root) return;
    var node = el("div", {
      class: "toast" + (variant ? " toast--" + variant : ""),
      role: "status",
      "aria-live": "polite"
    }, [
      UI.icon(
        variant === "danger" ? "alert" : variant === "success" ? "check" : "info",
        16
      ),
      el("span", { text: message })
    ]);
    root.appendChild(node);
    setTimeout(function () {
      node.classList.add("is-out");
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 200);
    }, ms || 2800);
  };

  UI.statPair = function (label, value, opts) {
    var o = opts || {};
    return el("div", { class: "stat-pair" }, [
      el("div", { class: "stat-pair__label", text: label }),
      el("div", {
        class: "stat-pair__value" + (o.soft ? " stat-pair__value--soft" : ""),
        text: value,
        style: o.color ? { color: o.color } : null
      })
    ]);
  };

  UI.kv = function (key, value) {
    return el("div", { class: "kv" }, [
      el("span", { class: "kv__key", text: key }),
      el("span", { class: "kv__value", text: value })
    ]);
  };

  UI.noteBlock = function (label, text, kind) {
    if (!text) return null;
    return el("div", { class: "note-block note-block--" + (kind || "student") }, [
      el("span", { class: "note-block__label", text: label }),
      el("span", { text: text })
    ]);
  };

  UI.sectionHead = function (title, subtitle, actions) {
    return el("div", { class: "section-head" }, [
      el("div", {}, [
        el("h2", { text: title }),
        subtitle ? el("p", { text: subtitle }) : null
      ]),
      el("div", { class: "section-head__spacer" }),
      actions || null
    ]);
  };
})(typeof window !== "undefined" ? window : globalThis);
