/* ==========================================================================
   charts.js - dependency-free SVG charts

   Deliberately no charting library: the student artifact must stay a single
   offline file, RTL-correct, printable, and themed from the same CSS tokens.
   Every chart draws ONLY from stats.js output - no chart invents data, and
   empty inputs return an explicit "not enough data" state instead of a
   misleading flat line at zero.

   MOBILE: a chart is drawn into a viewBox and then scaled to fit its box. A
   fixed 640-wide viewBox on a 320px phone scales to 0.41, which would render
   an 11px label at 4px. So the viewBox is matched to the viewport instead of
   being constant, and label density drops on narrow screens.

   Categories are laid out right-to-left to match the reading direction.
   ========================================================================== */
(function (global) {
  "use strict";

  var HDML = (global.HDML = global.HDML || {});
  var util = HDML.util;
  var UI = HDML.ui;
  var C = (HDML.charts = {});

  var NS = "http://www.w3.org/2000/svg";
  var doc = global.document;

  var PALETTE = {
    planned: "#c3cbdb",
    plannedStroke: "#a9b4c8",
    actual: "#2368e7",
    accent: "#cead3a",
    grid: "#e6eaf2",
    axis: "#9aa4bb",
    text: "#47536f",
    textSoft: "#77839d",
    navy: "#0e1a32"
  };

  C.PALETTE = PALETTE;

  /**
   * Drawing metrics matched to the current viewport, so label text keeps its
   * intended on-screen size instead of shrinking with the viewBox.
   */
  /*
   * A chart is rendered inside a card, so its real width is roughly
   *   viewport - page padding - card padding  (about 50px on a phone).
   * The viewBox is set close to that real width, and the font sizes are then
   * chosen so that after scaling they land at ~11px or more on screen.
   */
  function metrics(override) {
    var vw = override || global.innerWidth || 1024;
    if (vw < 400) {
      /* 320-399px: renders ~268-334px, scale ~0.9-1.1 */
      return { W: 300, fs: 14, fsSmall: 12.5, fsTiny: 11.5, ticks: 3, narrow: true };
    }
    if (vw < 560) {
      /* 400-559px: renders ~344-500px, scale ~0.95-1.4 */
      return { W: 360, fs: 13, fsSmall: 12, fsTiny: 11, ticks: 4, narrow: true };
    }
    if (vw < 900) {
      return { W: 520, fs: 12, fsSmall: 11, fsTiny: 10, ticks: 4, narrow: false };
    }
    return { W: 640, fs: 11.5, fsSmall: 10.5, fsTiny: 9.5, ticks: 4, narrow: false };
  }

  C.metrics = metrics;

  function svgEl(tag, attrs, children) {
    var node = doc.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] === null || attrs[k] === undefined) return;
        node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c) node.appendChild(c);
      });
    }
    return node;
  }

  C.svgEl = svgEl;

  function text(str, x, y, attrs) {
    var t = svgEl(
      "text",
      Object.assign(
        {
          x: x,
          y: y,
          fill: PALETTE.text,
          "font-size": "11",
          "text-anchor": "middle",
          "font-family": "inherit"
        },
        attrs || {}
      )
    );
    t.textContent = str;
    return t;
  }

  C.text = text;

  function withTitle(node, label) {
    if (!label) return node;
    var t = svgEl("title");
    t.textContent = label;
    node.appendChild(t);
    return node;
  }

  function chartRoot(width, height, ariaLabel) {
    return svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      class: "chart-svg",
      role: "img",
      "aria-label": ariaLabel || "نمودار",
      preserveAspectRatio: "xMidYMid meet",
      direction: "ltr"
    });
  }

  /** "Not enough data yet" - never a fake zeroed chart. */
  function emptyChart(message, hint) {
    return UI.el("div", { class: "empty", style: { padding: "24px 12px" } }, [
      UI.el("div", { class: "empty__icon" }, UI.icon("progress", 40)),
      UI.el("div", { class: "empty__title", text: message }),
      hint ? UI.el("p", { class: "empty__text", text: hint }) : null
    ]);
  }

  C.empty = emptyChart;

  function niceCeil(value) {
    if (value <= 0) return 60;
    var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    var normalized = value / magnitude;
    var step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
  }

  function legend(items) {
    return UI.el(
      "div",
      { class: "chart-legend" },
      items.map(function (item) {
        return UI.el("span", { class: "chart-legend__item" }, [
          UI.el("span", {
            class: "chart-legend__swatch",
            style: { background: item.color }
          }),
          UI.el("span", { text: item.label })
        ]);
      })
    );
  }

  C.legend = legend;

  C.plannedVsActual = function (series, options) {
    var opts = options || {};
    var M = metrics(opts.viewport);
    var data = (series || []).filter(function (d) {
      return d.plannedMinutes > 0 || d.actualMinutes > 0;
    });
    if (!data.length) {
      return emptyChart(
        "هنوز داده‌ای برای مقایسه نیست",
        "بعد از اینکه کارها را تیک بزنی، این نمودار پر می‌شود."
      );
    }

    var W = opts.width || M.W;
    var H = opts.height || (M.narrow ? 230 : 260);
    var padTop = 14;
    var padBottom = M.narrow ? 44 : 40;
    var padRight = M.narrow ? 34 : 46;
    var padLeft = 8;
    var plotW = W - padRight - padLeft;
    var plotH = H - padTop - padBottom;

    var maxVal = data.reduce(function (m, d) {
      return Math.max(m, d.plannedMinutes, d.actualMinutes);
    }, 0);
    var top = niceCeil(maxVal * 1.1);
    var scale = function (v) {
      return plotH - (v / top) * plotH;
    };

    var svg = chartRoot(W, H, "نمودار مقایسه زمان برنامه و زمان واقعی");
    var g = svgEl("g", { transform: "translate(" + padLeft + "," + padTop + ")" });

    for (var i = 0; i <= M.ticks; i++) {
      var v = (top / M.ticks) * i;
      var y = scale(v);
      g.appendChild(
        svgEl("line", {
          x1: 0,
          x2: plotW,
          y1: y,
          y2: y,
          stroke: PALETTE.grid,
          "stroke-width": 1
        })
      );
      g.appendChild(
        text(util.n(util.round(v / 60, v >= 60 ? 0 : 1)), plotW + padRight / 2, y + 4, {
          fill: PALETTE.textSoft,
          "font-size": M.fsSmall
        })
      );
    }
    g.appendChild(
      text("ساعت", plotW + padRight / 2, -3, {
        fill: PALETTE.textSoft,
        "font-size": M.fsTiny
      })
    );

    var step = plotW / data.length;
    var barW = Math.min(M.narrow ? 11 : 16, step * 0.32);
    var gap = M.narrow ? 2 : 3;

    data.forEach(function (d, idx) {
      var center = plotW - (idx + 0.5) * step; /* right-to-left */

      g.appendChild(
        withTitle(
          svgEl("rect", {
            x: center + gap / 2,
            y: scale(d.plannedMinutes),
            width: barW,
            height: Math.max(0, plotH - scale(d.plannedMinutes)),
            rx: 3,
            fill: PALETTE.planned
          }),
          d.dayName + " — برنامه: " + util.fmtDur(d.plannedMinutes)
        )
      );

      g.appendChild(
        withTitle(
          svgEl("rect", {
            x: center - barW - gap / 2,
            y: scale(d.actualMinutes),
            width: barW,
            height: Math.max(0, plotH - scale(d.actualMinutes)),
            rx: 3,
            fill: d.isFuture ? "#c9d8f6" : PALETTE.actual
          }),
          d.dayName + " — واقعی: " + util.fmtDur(d.actualMinutes)
        )
      );

      /* Full day names do not fit on a phone; the short form does. */
      g.appendChild(
        text(M.narrow ? d.dayName.slice(0, 1) : d.dayName, center, plotH + 16, {
          fill: PALETTE.textSoft,
          "font-size": M.fs,
          direction: "rtl"
        })
      );
      if (!M.narrow || data.length <= 7) {
        g.appendChild(
          text(d.label, center, plotH + 30, {
            fill: PALETTE.axis,
            "font-size": M.fsTiny
          })
        );
      }
    });

    g.appendChild(
      svgEl("line", {
        x1: 0,
        x2: plotW,
        y1: plotH,
        y2: plotH,
        stroke: PALETTE.axis,
        "stroke-width": 1
      })
    );

    svg.appendChild(g);

    return UI.el("div", {}, [
      UI.el("div", { class: "chart-box" }, svg),
      legend([
        { label: "واقعی", color: PALETTE.actual },
        { label: "برنامه", color: PALETTE.planned }
      ])
    ]);
  };

  C.studyTrend = function (series, options) {
    var opts = options || {};
    var M = metrics(opts.viewport);

    /* Days that have happened, plus any future-dated day already worked on. */
    var data = (series || []).filter(function (d) {
      return !d.isFuture || d.actualMinutes > 0;
    });

    if (!HDML.stats.hasTrendData(data)) {
      return emptyChart(
        "هنوز سابقه‌ی کافی نیست",
        "برای دیدن روند، حداقل دو روز با زمان مطالعه لازم است."
      );
    }

    var W = opts.width || M.W;
    var H = opts.height || (M.narrow ? 210 : 240);
    var padTop = 16;
    var padBottom = 34;
    var padRight = M.narrow ? 32 : 44;
    var padLeft = 8;
    var plotW = W - padRight - padLeft;
    var plotH = H - padTop - padBottom;

    var maxVal = data.reduce(function (m, d) {
      return Math.max(m, d.actualMinutes);
    }, 0);
    var top = niceCeil(maxVal * 1.15);

    var xAt = function (i) {
      if (data.length === 1) return plotW / 2;
      return plotW - (i / (data.length - 1)) * plotW;
    };
    var yAt = function (v) {
      return plotH - (v / top) * plotH;
    };

    var svg = chartRoot(W, H, "نمودار روند ساعت مطالعه‌ی روزانه");
    var g = svgEl("g", { transform: "translate(" + padLeft + "," + padTop + ")" });

    for (var i = 0; i <= M.ticks; i++) {
      var v = (top / M.ticks) * i;
      var y = yAt(v);
      g.appendChild(
        svgEl("line", {
          x1: 0,
          x2: plotW,
          y1: y,
          y2: y,
          stroke: PALETTE.grid,
          "stroke-width": 1
        })
      );
      g.appendChild(
        text(util.n(util.round(v / 60, v >= 60 ? 0 : 1)), plotW + padRight / 2, y + 4, {
          fill: PALETTE.textSoft,
          "font-size": M.fsSmall
        })
      );
    }
    g.appendChild(
      text("ساعت", plotW + padRight / 2, -4, {
        fill: PALETTE.textSoft,
        "font-size": M.fsTiny
      })
    );

    var linePts = data.map(function (d, i) {
      return xAt(i) + "," + yAt(d.actualMinutes);
    });

    var gradId = "tg" + Math.random().toString(36).slice(2, 8);
    var defs = svgEl("defs");
    var grad = svgEl("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(
      svgEl("stop", { offset: "0%", "stop-color": PALETTE.actual, "stop-opacity": "0.34" })
    );
    grad.appendChild(
      svgEl("stop", { offset: "100%", "stop-color": PALETTE.actual, "stop-opacity": "0.02" })
    );
    defs.appendChild(grad);
    svg.appendChild(defs);

    g.appendChild(
      svgEl("polygon", {
        points:
          xAt(0) + "," + plotH + " " + linePts.join(" ") + " " + xAt(data.length - 1) + "," + plotH,
        fill: "url(#" + gradId + ")"
      })
    );
    g.appendChild(
      svgEl("polyline", {
        points: linePts.join(" "),
        fill: "none",
        stroke: PALETTE.actual,
        "stroke-width": M.narrow ? 2.6 : 2.2,
        "stroke-linejoin": "round",
        "stroke-linecap": "round"
      })
    );

    var avg =
      data.reduce(function (a, d) {
        return a + d.actualMinutes;
      }, 0) / data.length;
    g.appendChild(
      svgEl("line", {
        x1: 0,
        x2: plotW,
        y1: yAt(avg),
        y2: yAt(avg),
        stroke: PALETTE.accent,
        "stroke-width": 1.4,
        "stroke-dasharray": "5 4"
      })
    );
    g.appendChild(
      text("میانگین " + util.fmtHM(avg), plotW * 0.18, yAt(avg) - 6, {
        fill: "#a98a24",
        "font-size": M.fsSmall
      })
    );

    /* Keep roughly one label per 52px of width so they never collide. */
    var maxLabels = Math.max(2, Math.floor(plotW / 52));
    var labelEvery = Math.ceil(data.length / maxLabels);

    data.forEach(function (d, i) {
      var x = xAt(i);
      var y = yAt(d.actualMinutes);
      g.appendChild(
        withTitle(
          svgEl("circle", {
            cx: x,
            cy: y,
            r: M.narrow ? 3.8 : 3.4,
            fill: "#fff",
            stroke: PALETTE.actual,
            "stroke-width": 2
          }),
          d.dayName + " " + d.label + " — " + util.fmtDur(d.actualMinutes)
        )
      );
      if (i % labelEvery === 0 || i === data.length - 1) {
        g.appendChild(
          text(d.label, x, plotH + 16, {
            fill: PALETTE.textSoft,
            "font-size": M.fsSmall
          })
        );
      }
    });

    g.appendChild(
      svgEl("line", {
        x1: 0,
        x2: plotW,
        y1: plotH,
        y2: plotH,
        stroke: PALETTE.axis,
        "stroke-width": 1
      })
    );

    svg.appendChild(g);

    return UI.el("div", {}, [
      UI.el("div", { class: "chart-box" }, svg),
      UI.el("div", {
        class: "chart-note",
        text: "ساعت مطالعه‌ی هر روز · " + util.n(data.length) + " روز"
      })
    ]);
  };

  C.subjectRadar = function (rows, options) {
    var opts = options || {};
    var M = metrics(opts.viewport);
    var data = (rows || []).filter(function (r) {
      return r.plannedMinutes > 0 || r.actualMinutes > 0;
    });

    if (data.length < 3) {
      return emptyChart("برای نمودار راداری حداقل سه درس لازم است");
    }

    var size = opts.size || (M.narrow ? M.W : 320);
    var cx = size / 2;
    var cy = size / 2 + 4;
    /* Labels sit outside the ring - leave room or they clip on a phone. */
    var radius = size / 2 - (M.narrow ? 58 : 54);
    var n = data.length;

    var svg = chartRoot(size, size + 10, "نمودار راداری پیشرفت دروس");

    function point(index, ratio) {
      var angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
      return {
        x: cx + Math.cos(angle) * radius * ratio,
        y: cy + Math.sin(angle) * radius * ratio
      };
    }

    [0.25, 0.5, 0.75, 1].forEach(function (ratio) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var p = point(i, ratio);
        pts.push(p.x + "," + p.y);
      }
      svg.appendChild(
        svgEl("polygon", {
          points: pts.join(" "),
          fill: ratio === 1 ? "#fbfcfe" : "none",
          stroke: ratio === 1 ? PALETTE.axis : PALETTE.grid,
          "stroke-width": ratio === 1 ? 1.4 : 1
        })
      );
    });

    for (var i = 0; i < n; i++) {
      var p = point(i, 1);
      svg.appendChild(
        svgEl("line", {
          x1: cx,
          y1: cy,
          x2: p.x,
          y2: p.y,
          stroke: PALETTE.grid,
          "stroke-width": 1
        })
      );
    }

    var dataPts = [];
    data.forEach(function (row, idx) {
      var pt = point(idx, util.clamp(row.value / 100, 0, 1));
      dataPts.push(pt.x + "," + pt.y);
    });

    svg.appendChild(
      svgEl("polygon", {
        points: dataPts.join(" "),
        fill: "rgba(35,104,231,0.22)",
        stroke: PALETTE.actual,
        "stroke-width": 2,
        "stroke-linejoin": "round"
      })
    );

    data.forEach(function (row, idx) {
      var pt = point(idx, util.clamp(row.value / 100, 0, 1));
      svg.appendChild(
        withTitle(
          svgEl("circle", {
            cx: pt.x,
            cy: pt.y,
            r: 3.6,
            fill: "#fff",
            stroke: row.color || PALETTE.actual,
            "stroke-width": 2
          }),
          row.name + " — " + util.fmtPct(row.value)
        )
      );

      var lp = point(idx, 1.14);
      var anchor = Math.abs(lp.x - cx) < 12 ? "middle" : lp.x > cx ? "start" : "end";
      svg.appendChild(
        text(util.truncate(row.name, M.narrow ? 9 : 14), lp.x, lp.y + 4, {
          "text-anchor": anchor,
          fill: PALETTE.navy,
          "font-size": M.fs,
          direction: "rtl"
        })
      );
      svg.appendChild(
        text(util.fmtPct(row.value), lp.x, lp.y + 16, {
          "text-anchor": anchor,
          fill: PALETTE.textSoft,
          "font-size": M.fsSmall
        })
      );
    });

    return UI.el("div", {}, [
      UI.el("div", { class: "chart-box" }, svg),
      UI.el("div", {
        class: "chart-note",
        text: "درصد = زمان واقعی ÷ زمان برنامه‌ی همان درس"
      })
    ]);
  };

  C.subjectBars = function (rows, options) {
    var opts = options || {};
    var M = metrics(opts.viewport);
    var data = (rows || [])
      .filter(function (r) {
        return r.plannedMinutes > 0 || r.actualMinutes > 0;
      })
      .slice(0, opts.limit || 12);

    if (!data.length) return emptyChart("هنوز مطالعه‌ای ثبت نشده است");

    var W = opts.width || M.W;
    var rowH = M.narrow ? 40 : 34;
    var labelW = M.narrow ? 72 : 108;
    var padRight = M.narrow ? 46 : 58;
    var H = data.length * rowH + 12;
    var barW = W - labelW - padRight;

    var maxVal = data.reduce(function (m, r) {
      return Math.max(m, r.plannedMinutes, r.actualMinutes);
    }, 0);
    var top = niceCeil(maxVal * 1.05);

    var svg = chartRoot(W, H, "مقایسه‌ی زمان برنامه و واقعی به تفکیک درس");

    data.forEach(function (r, i) {
      var y = i * rowH + 6;
      svg.appendChild(
        text(util.truncate(r.name, M.narrow ? 9 : 14), W - 4, y + 15, {
          "text-anchor": "end",
          fill: PALETTE.navy,
          "font-size": M.fs,
          direction: "rtl"
        })
      );

      var plannedLen = (r.plannedMinutes / top) * barW;
      var actualLen = (r.actualMinutes / top) * barW;
      var right = W - labelW;

      svg.appendChild(
        withTitle(
          svgEl("rect", {
            x: right - plannedLen,
            y: y + 3,
            width: Math.max(1, plannedLen),
            height: M.narrow ? 10 : 9,
            rx: 4,
            fill: PALETTE.planned
          }),
          r.name + " — برنامه: " + util.fmtDur(r.plannedMinutes)
        )
      );
      svg.appendChild(
        withTitle(
          svgEl("rect", {
            x: right - actualLen,
            y: y + (M.narrow ? 17 : 15),
            width: Math.max(1, actualLen),
            height: M.narrow ? 10 : 9,
            rx: 4,
            fill: r.color || PALETTE.actual
          }),
          r.name + " — واقعی: " + util.fmtDur(r.actualMinutes)
        )
      );

      svg.appendChild(
        text(
          util.fmtHM(r.actualMinutes) + " / " + util.fmtHM(r.plannedMinutes),
          2,
          y + (M.narrow ? 19 : 17),
          { "text-anchor": "start", fill: PALETTE.textSoft, "font-size": M.fsSmall }
        )
      );
    });

    return UI.el("div", {}, [
      UI.el("div", { class: "chart-box" }, svg),
      legend([
        { label: "واقعی", color: PALETTE.actual },
        { label: "برنامه", color: PALETTE.planned }
      ])
    ]);
  };

  C.ring = function (rate, options) {
    var opts = options || {};
    var size = opts.size || 92;
    var stroke = opts.stroke || 9;
    var r = (size - stroke) / 2;
    var circumference = 2 * Math.PI * r;
    var value = rate === null ? 0 : util.clamp(rate, 0, 100);
    var color = util.toneColor(opts.tone || util.rateTone(rate));

    var svg = chartRoot(size, size, (opts.label || "پیشرفت") + " " + util.fmtPct(rate));
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.style.width = size + "px";
    svg.style.height = size + "px";

    svg.appendChild(
      svgEl("circle", {
        cx: size / 2,
        cy: size / 2,
        r: r,
        fill: "none",
        stroke: "#eef1f8",
        "stroke-width": stroke
      })
    );
    svg.appendChild(
      svgEl("circle", {
        cx: size / 2,
        cy: size / 2,
        r: r,
        fill: "none",
        stroke: color,
        "stroke-width": stroke,
        "stroke-linecap": "round",
        "stroke-dasharray": circumference,
        "stroke-dashoffset": circumference * (1 - value / 100),
        transform: "rotate(-90 " + size / 2 + " " + size / 2 + ")"
      })
    );
    svg.appendChild(
      text(rate === null ? "—" : util.fmtPct(rate), size / 2, size / 2 + 5, {
        "font-size": size > 80 ? "16" : "13",
        "font-weight": "700",
        fill: PALETTE.navy
      })
    );
    return svg;
  };

  C.examTrend = function (points, options) {
    var opts = options || {};
    var M = metrics(opts.viewport);
    var data = points || [];
    if (data.length < 2) {
      return emptyChart(
        "برای دیدن روند، حداقل دو آزمون لازم است",
        data.length === 1 ? "تا حالا یک آزمون ثبت کرده‌ای." : "هنوز آزمونی ثبت نشده."
      );
    }

    var W = opts.width || M.W;
    var H = opts.height || (M.narrow ? 215 : 230);
    var padTop = 22;
    var padBottom = M.narrow ? 46 : 42;
    var padRight = M.narrow ? 34 : 40;
    var plotW = W - padRight - 8;
    var plotH = H - padTop - padBottom;

    var values = data.map(function (p) {
      return p.value;
    });
    var lo = Math.floor(Math.min.apply(null, values.concat([0])) / 10) * 10;
    var hi = Math.ceil(Math.max(Math.max.apply(null, values) * 1.1, lo + 20) / 10) * 10;

    var xAt = function (i) {
      return data.length === 1 ? plotW / 2 : plotW - (i / (data.length - 1)) * plotW;
    };
    var yAt = function (v) {
      return plotH - ((v - lo) / (hi - lo)) * plotH;
    };

    var svg = chartRoot(W, H, "نمودار روند درصد کل آزمون‌ها");
    var g = svgEl("g", { transform: "translate(8," + padTop + ")" });

    for (var i = 0; i <= M.ticks; i++) {
      var v = lo + ((hi - lo) / M.ticks) * i;
      var y = yAt(v);
      g.appendChild(
        svgEl("line", {
          x1: 0,
          x2: plotW,
          y1: y,
          y2: y,
          stroke: PALETTE.grid,
          "stroke-width": 1
        })
      );
      g.appendChild(
        text(util.n(util.round(v, 0)) + "٪", plotW + padRight / 2, y + 4, {
          fill: PALETTE.textSoft,
          "font-size": M.fsSmall
        })
      );
    }

    g.appendChild(
      svgEl("polyline", {
        points: data
          .map(function (p, idx) {
            return xAt(idx) + "," + yAt(p.value);
          })
          .join(" "),
        fill: "none",
        stroke: PALETTE.actual,
        "stroke-width": 2.4,
        "stroke-linejoin": "round"
      })
    );

    var maxLabels = Math.max(2, Math.floor(plotW / 58));
    var every = Math.ceil(data.length / maxLabels);

    data.forEach(function (p, idx) {
      var x = xAt(idx);
      var y = yAt(p.value);
      g.appendChild(
        withTitle(
          svgEl("circle", {
            cx: x,
            cy: y,
            r: 4.2,
            fill: "#fff",
            stroke: PALETTE.actual,
            "stroke-width": 2.4
          }),
          p.label + " — " + util.fmtPct(p.value)
        )
      );
      g.appendChild(
        text(util.fmtPct(p.value), x, y - 11, {
          fill: PALETTE.navy,
          "font-size": M.fsSmall,
          "font-weight": "700"
        })
      );
      if (idx % every === 0 || idx === data.length - 1) {
        g.appendChild(
          text(util.truncate(p.label, M.narrow ? 8 : 12), x, plotH + 16, {
            fill: PALETTE.textSoft,
            "font-size": M.fsSmall,
            direction: "rtl"
          })
        );
        g.appendChild(
          text(HDML.date.format(p.date, "short"), x, plotH + 30, {
            fill: PALETTE.axis,
            "font-size": M.fsTiny
          })
        );
      }
    });

    g.appendChild(
      svgEl("line", {
        x1: 0,
        x2: plotW,
        y1: plotH,
        y2: plotH,
        stroke: PALETTE.axis,
        "stroke-width": 1
      })
    );

    svg.appendChild(g);
    return UI.el("div", { class: "chart-box" }, svg);
  };

  C.examSubjectTrend = function (seriesList, options) {
    var opts = options || {};
    var M = metrics(opts.viewport);
    var series = (seriesList || []).filter(function (s) {
      return s.points.length >= 2;
    });
    if (!series.length) {
      return emptyChart("برای روند درسی، حداقل دو آزمون با نتیجه لازم است");
    }

    var W = opts.width || M.W;
    var H = opts.height || (M.narrow ? 220 : 250);
    var padTop = 16;
    var padBottom = 38;
    var padRight = M.narrow ? 34 : 42;
    var plotW = W - padRight - 8;
    var plotH = H - padTop - padBottom;

    var allDates = {};
    series.forEach(function (s) {
      s.points.forEach(function (p) {
        allDates[p.date] = p.label;
      });
    });
    var dates = Object.keys(allDates).sort();

    var allVals = [];
    series.forEach(function (s) {
      s.points.forEach(function (p) {
        allVals.push(p.value);
      });
    });
    var lo = Math.floor(Math.min.apply(null, allVals.concat([0])) / 10) * 10;
    var hi = Math.ceil((Math.max.apply(null, allVals) * 1.1) / 10) * 10;
    if (hi <= lo) hi = lo + 20;

    var xAt = function (date) {
      var i = dates.indexOf(date);
      return dates.length === 1 ? plotW / 2 : plotW - (i / (dates.length - 1)) * plotW;
    };
    var yAt = function (v) {
      return plotH - ((v - lo) / (hi - lo)) * plotH;
    };

    var svg = chartRoot(W, H, "روند درصد هر درس در آزمون‌ها");
    var g = svgEl("g", { transform: "translate(8," + padTop + ")" });

    for (var i = 0; i <= M.ticks; i++) {
      var v = lo + ((hi - lo) / M.ticks) * i;
      var y = yAt(v);
      g.appendChild(
        svgEl("line", { x1: 0, x2: plotW, y1: y, y2: y, stroke: PALETTE.grid, "stroke-width": 1 })
      );
      g.appendChild(
        text(util.n(util.round(v, 0)) + "٪", plotW + padRight / 2, y + 4, {
          fill: PALETTE.textSoft,
          "font-size": M.fsSmall
        })
      );
    }

    series.forEach(function (s) {
      var sorted = s.points.slice().sort(function (a, b) {
        return a.date < b.date ? -1 : 1;
      });
      g.appendChild(
        svgEl("polyline", {
          points: sorted
            .map(function (p) {
              return xAt(p.date) + "," + yAt(p.value);
            })
            .join(" "),
          fill: "none",
          stroke: s.color,
          "stroke-width": 2,
          "stroke-linejoin": "round"
        })
      );
      sorted.forEach(function (p) {
        g.appendChild(
          withTitle(
            svgEl("circle", { cx: xAt(p.date), cy: yAt(p.value), r: 3, fill: s.color }),
            s.name + " — " + p.label + ": " + util.fmtPct(p.value)
          )
        );
      });
    });

    var every = Math.ceil(dates.length / Math.max(2, Math.floor(plotW / 58)));
    dates.forEach(function (dt, idx) {
      if (idx % every !== 0 && idx !== dates.length - 1) return;
      g.appendChild(
        text(util.truncate(allDates[dt], M.narrow ? 8 : 10), xAt(dt), plotH + 16, {
          fill: PALETTE.textSoft,
          "font-size": M.fsSmall,
          direction: "rtl"
        })
      );
    });

    g.appendChild(
      svgEl("line", {
        x1: 0,
        x2: plotW,
        y1: plotH,
        y2: plotH,
        stroke: PALETTE.axis,
        "stroke-width": 1
      })
    );

    svg.appendChild(g);

    return UI.el("div", {}, [
      UI.el("div", { class: "chart-box" }, svg),
      legend(
        series.map(function (s) {
          return { label: s.name, color: s.color };
        })
      )
    ]);
  };

  C.completionDonut = function (agg, options) {
    var opts = options || {};
    var M = metrics(opts.viewport);
    var total = agg.totalTasks;
    if (!total) return emptyChart("هنوز کاری تعریف نشده است");

    var size = opts.size || (M.narrow ? 170 : 190);
    var cx = size / 2;
    var cy = size / 2;
    var r = size / 2 - 16;
    var stroke = 20;

    var slices = [
      { label: "انجام‌شده", value: agg.completedTasks, color: "#16875a" },
      { label: "در حال انجام", value: agg.inProgressTasks, color: "#2368e7" },
      { label: "انجام‌نشد", value: agg.skippedTasks, color: "#b06f0a" },
      { label: "مانده", value: agg.pendingTasks, color: "#dfe4ee" }
    ].filter(function (s) {
      return s.value > 0;
    });

    var svg = chartRoot(size, size, "توزیع وضعیت کارها");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);

    var circumference = 2 * Math.PI * r;
    var offset = 0;

    slices.forEach(function (s) {
      var len = (s.value / total) * circumference;
      svg.appendChild(
        withTitle(
          svgEl("circle", {
            cx: cx,
            cy: cy,
            r: r,
            fill: "none",
            stroke: s.color,
            "stroke-width": stroke,
            "stroke-dasharray": len + " " + (circumference - len),
            "stroke-dashoffset": -offset,
            transform: "rotate(-90 " + cx + " " + cy + ")"
          }),
          s.label + ": " + util.n(s.value) + " کار"
        )
      );
      offset += len;
    });

    svg.appendChild(
      text(util.n(agg.completedTasks) + "/" + util.n(total), cx, cy + 2, {
        "font-size": "19",
        "font-weight": "700",
        fill: PALETTE.navy
      })
    );
    svg.appendChild(
      text("انجام‌شده", cx, cy + 19, {
        "font-size": "11",
        fill: PALETTE.textSoft,
        direction: "rtl"
      })
    );

    return UI.el("div", { style: { display: "flex", "justify-content": "center" } }, [
      UI.el("div", {}, [
        svg,
        legend(
          slices.map(function (s) {
            return { label: s.label + " (" + util.n(s.value) + ")", color: s.color };
          })
        )
      ])
    ]);
  };
})(typeof window !== "undefined" ? window : globalThis);
