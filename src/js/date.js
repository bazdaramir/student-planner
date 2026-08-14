/* ==========================================================================
   date.js - Gregorian storage, Jalali (Persian) display layer

   Dates are ALWAYS stored as ISO "YYYY-MM-DD" Gregorian strings. Jalali is a
   pure display concern. The conversion is the well-established Borkowski
   algorithm (as used by jalaali-js), which is exact for 1178..1633 Jalali.
   ========================================================================== */
(function (global) {
  "use strict";

  var HDML = (global.HDML = global.HDML || {});
  var util = HDML.util;
  var D = (HDML.date = {});

  D.JALALI_MONTHS = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند"
  ];

  /* Index 0 is Saturday - the first day of the Iranian week. */
  D.WEEK_DAYS = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنج‌شنبه",
    "جمعه"
  ];

  D.WEEK_DAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

  function div(a, b) {
    return ~~(a / b);
  }

  function mod(a, b) {
    return a - ~~(a / b) * b;
  }

  var BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178
  ];

  function jalCal(jy, withoutLeap) {
    var bl = BREAKS.length;
    var gy = jy + 621;
    var leapJ = -14;
    var jp = BREAKS[0];
    var jm, jump, leap, n, i;

    if (jy < jp || jy >= BREAKS[bl - 1]) {
      throw new Error("Jalaali year out of range: " + jy);
    }

    for (i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;

    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

    var leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    var march = 20 + leapJ - leapG;

    if (!withoutLeap) {
      if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
      leap = mod(mod(n + 1, 33) - 1, 4);
      if (leap === -1) leap = 4;
    }

    return { leap: leap, gy: gy, march: march };
  }

  /** Gregorian calendar date -> Julian Day Number. */
  function g2d(gy, gm, gd) {
    var d =
      div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
      div(153 * mod(gm + 9, 12) + 2, 5) +
      gd -
      34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  /** Julian Day Number -> Gregorian calendar date. */
  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div(mod(j, 1461), 4) * 5 + 308;
    var gd = div(mod(i, 153), 5) + 1;
    var gm = mod(div(i, 153), 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }

  function j2d(jy, jm, jd) {
    var r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    var gy = d2g(jdn).gy;
    var jy = gy - 621;
    var r = jalCal(jy, false);
    var jdn1f = g2d(gy, 3, r.march);
    var jd, jm, k;

    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy: jy, jm: jm, jd: jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }

  D.toJalali = function (gy, gm, gd) {
    return d2j(g2d(gy, gm, gd));
  };

  D.toGregorian = function (jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
  };

  D.isJalaliLeap = function (jy) {
    return jalCal(jy, false).leap === 0;
  };

  D.jalaliMonthLength = function (jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return D.isJalaliLeap(jy) ? 30 : 29;
  };

  D.isValidJalali = function (jy, jm, jd) {
    return (
      jy >= 1178 &&
      jy <= 1632 &&
      jm >= 1 &&
      jm <= 12 &&
      jd >= 1 &&
      jd <= D.jalaliMonthLength(jy, jm)
    );
  };

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /** Local-time ISO date (never UTC - avoids off-by-one across timezones). */
  D.toISO = function (dateObj) {
    return (
      dateObj.getFullYear() +
      "-" +
      pad2(dateObj.getMonth() + 1) +
      "-" +
      pad2(dateObj.getDate())
    );
  };

  D.today = function () {
    return D.toISO(new Date());
  };

  D.isValidISO = function (iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return (
      d.getFullYear() === +p[0] &&
      d.getMonth() === +p[1] - 1 &&
      d.getDate() === +p[2]
    );
  };

  D.parseISO = function (iso) {
    var p = String(iso).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  };

  D.addDays = function (iso, n) {
    var d = D.parseISO(iso);
    d.setDate(d.getDate() + n);
    return D.toISO(d);
  };

  D.diffDays = function (isoA, isoB) {
    var a = D.parseISO(isoA);
    var b = D.parseISO(isoB);
    return Math.round((b - a) / 86400000);
  };

  D.compare = function (isoA, isoB) {
    return isoA < isoB ? -1 : isoA > isoB ? 1 : 0;
  };

  /** 0 = Saturday .. 6 = Friday (Iranian week order). */
  D.dowIndex = function (iso) {
    return (D.parseISO(iso).getDay() + 1) % 7;
  };

  /** ISO date of the Saturday that starts the week containing `iso`. */
  D.weekStart = function (iso) {
    return D.addDays(iso, -D.dowIndex(iso));
  };

  D.weekDates = function (startIso) {
    var out = [];
    for (var i = 0; i < 7; i++) out.push(D.addDays(startIso, i));
    return out;
  };

  D.jalaliOf = function (iso) {
    var d = D.parseISO(iso);
    return D.toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };

  /**
   * style:
   *   'full'    -> "شنبه ۲۳ مرداد ۱۴۰۵"
   *   'long'    -> "۲۳ مرداد ۱۴۰۵"
   *   'medium'  -> "۲۳ مرداد"
   *   'dow'     -> "شنبه ۲۳ مرداد"
   *   'numeric' -> "۱۴۰۵/۰۵/۲۳"
   *   'short'   -> "۰۵/۲۳"
   */
  D.format = function (iso, style) {
    if (!D.isValidISO(iso)) return "—";
    var j = D.jalaliOf(iso);
    var n = util.n;
    var month = D.JALALI_MONTHS[j.jm - 1];
    var dow = D.WEEK_DAYS[D.dowIndex(iso)];

    switch (style || "long") {
      case "full":
        return dow + " " + n(j.jd) + " " + month + " " + n(j.jy);
      case "medium":
        return n(j.jd) + " " + month;
      case "dow":
        return dow + " " + n(j.jd) + " " + month;
      case "numeric":
        return n(j.jy) + "/" + n(pad2(j.jm)) + "/" + n(pad2(j.jd));
      case "short":
        return n(pad2(j.jm)) + "/" + n(pad2(j.jd));
      default:
        return n(j.jd) + " " + month + " " + n(j.jy);
    }
  };

  D.formatRange = function (startIso, endIso) {
    if (!D.isValidISO(startIso) || !D.isValidISO(endIso)) return "—";
    var a = D.jalaliOf(startIso);
    var b = D.jalaliOf(endIso);
    var n = util.n;
    if (a.jm === b.jm && a.jy === b.jy) {
      return (
        n(a.jd) + " تا " + n(b.jd) + " " + D.JALALI_MONTHS[b.jm - 1] + " " + n(b.jy)
      );
    }
    return (
      n(a.jd) +
      " " +
      D.JALALI_MONTHS[a.jm - 1] +
      " تا " +
      n(b.jd) +
      " " +
      D.JALALI_MONTHS[b.jm - 1] +
      " " +
      n(b.jy)
    );
  };

  D.dayName = function (iso) {
    return D.WEEK_DAYS[D.dowIndex(iso)];
  };

  /** Accepts "۱۴۰۵/۰۵/۲۳" or "1405-5-23" and returns an ISO Gregorian date. */
  D.jalaliInputToISO = function (input) {
    var s = util.enDigits(String(input || "").trim()).replace(/[-.]/g, "/");
    var parts = s.split("/");
    if (parts.length !== 3) return null;
    var jy = parseInt(parts[0], 10);
    var jm = parseInt(parts[1], 10);
    var jd = parseInt(parts[2], 10);
    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;
    if (jy < 200) jy += 1400;
    if (!D.isValidJalali(jy, jm, jd)) return null;
    var g = D.toGregorian(jy, jm, jd);
    return g.gy + "-" + pad2(g.gm) + "-" + pad2(g.gd);
  };

  D.isoToJalaliInput = function (iso) {
    if (!D.isValidISO(iso)) return "";
    var j = D.jalaliOf(iso);
    return j.jy + "/" + pad2(j.jm) + "/" + pad2(j.jd);
  };

  /** Human "امروز / دیروز / فردا" when close, otherwise a date. */
  D.relativeLabel = function (iso, todayIso) {
    var t = todayIso || D.today();
    var diff = D.diffDays(t, iso);
    if (diff === 0) return "امروز";
    if (diff === -1) return "دیروز";
    if (diff === 1) return "فردا";
    return D.format(iso, "medium");
  };

  /** ISO timestamp for logs (kept in full ISO-8601 with timezone offset). */
  D.now = function () {
    return new Date().toISOString();
  };
})(typeof window !== "undefined" ? window : globalThis);
