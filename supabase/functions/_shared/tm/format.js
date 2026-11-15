/* Tabitha's Misery — display helpers.
 * Plain browser JS (no modules) so it can be pasted into app.js or loaded before it.
 * Every number, date and bank string on screen should go through one of these.
 */
(function (global) {
  'use strict';

  const MINUS = '−'; // real minus sign, not a hyphen
  const NBSP = ' ';

  /** 3394290 -> "Rp 3.394.290". Integers only (IDR has no decimals). */
  function rp(amount) {
    const n = Math.round(Math.abs(Number(amount) || 0));
    return 'Rp' + NBSP + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** Signed amount for a transaction row. type: 'DB' (expense) | 'CR' (income). */
  function rpSigned(amount, type) {
    return (type === 'CR' ? '+' : MINUS) + rp(amount);
  }

  /** Chart axis labels: 0, 250rb, 500rb, 1jt, 1,5jt, 12jt. */
  function rpCompact(amount) {
    const n = Math.abs(Number(amount) || 0);
    if (n === 0) return '0';
    if (n >= 1e9) return trim(n / 1e9) + 'M';
    if (n >= 1e6) return trim(n / 1e6) + 'jt';
    if (n >= 1e3) return trim(n / 1e3) + 'rb';
    return String(n);
    function trim(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }
  }

  /** Hero size step by digit count, so 15 digits fit at 360px. Returns a Tailwind text class. */
  function heroClass(amount) {
    const digits = String(Math.round(Math.abs(Number(amount) || 0))).length;
    if (digits <= 10) return 'text-money';
    if (digits <= 13) return 'text-money-s';
    return 'text-money-xs';
  }

  /* ---------- Bank descriptions ---------- */

  const ACRONYMS = new Set(['PT', 'CV', 'BCA', 'BNI', 'BRI', 'OVO', 'KRL', 'PLN', 'QRIS', 'BI', 'CGV', 'MRT', 'LRT', 'ATM', 'VA']);
  const SMALL = new Set(['to', 'from', 'of', 'and', 'at', 'via']);

  function titleCase(s) {
    return String(s).trim().split(/\s+/).map(function (word, i) {
      if (ACRONYMS.has(word)) return word;
      if (word.indexOf('-') > 0) {
        return word.split('-').map(function (p) { return ACRONYMS.has(p) ? p : cap(p); }).join('-');
      }
      const low = word.toLowerCase();
      if (i > 0 && SMALL.has(low)) return low;
      return cap(word);
    }).join(' ');
    function cap(w) { const l = w.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); }
  }

  /**
   * Merchant-first split. "QRIS PAYMENT - KOPI KENANGAN SENOPATI"
   *   -> { title: "Kopi Kenangan Senopati", via: "QRIS Payment" }
   * No " - " separator: whole string is the title, via is ''.
   * Hand-typed descriptions (not all caps) are returned untouched.
   */
  function splitDescription(desc) {
    const raw = String(desc || '').trim();
    const isBank = raw === raw.toUpperCase() && /[A-Z]/.test(raw);
    if (!isBank) return { title: raw, via: '' };
    const i = raw.lastIndexOf(' - ');
    if (i < 0) return { title: titleCase(raw), via: '' };
    return { title: titleCase(raw.slice(i + 3)), via: titleCase(raw.slice(0, i)) };
  }

  /**
   * Suggested rule keyword (prefill only; the user can edit it before saving).
   * "QRIS PAYMENT - SUPERINDO KEMANG" -> "SUPERINDO", "QRIS PAYMENT - KOPI KENANGAN SENOPATI" -> "KOPI KENANGAN",
   * "...- PT VISIONET INTERNASIONAL / OVO" -> "OVO", "PLN PREPAID TOKEN" -> "PLN", BI-FAST transfers -> "" (no rule).
   */
  function suggestKeyword(desc) {
    const raw = String(desc || '').toUpperCase().trim();
    if (/^BI-FAST|TRANSFER TO OTHER BANK/.test(raw)) return ''; // person-to-person: rules won't help
    const i = raw.lastIndexOf(' - ');
    if (i < 0) return raw.split(/\s+/)[0];                        // "TELKOMSEL POSTPAID" -> "TELKOMSEL"
    const parts = raw.slice(i + 3).split(/\s*\/\s*/);              // keep the last "/"-part
    const words = parts[parts.length - 1].replace(/\.COM$/, '').split(/\s+/)
      .filter(function (w) { return w !== 'PT' && w !== 'CV'; });
    if (!words.length) return '';
    return words[0].length < 6 && words[1] ? words[0] + ' ' + words[1] : words[0]; // short first word: take two
  }

  /* ---------- Dates (English UI, Indonesian conventions) ---------- */

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function parseISO(iso) { const p = String(iso).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2] || 1); }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  /** "13 Oct 2026" */
  function dateLong(iso) { const d = parseISO(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  /** "Tue, 13 Oct" */
  function dateShort(iso) { const d = parseISO(iso); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  /** "October 2026" from "2026-10" */
  function monthLabel(ym) { const d = parseISO(ym + '-01'); return MONTH[d.getMonth()] + ' ' + d.getFullYear(); }
  /** "Oct 2026" from "2026-10" (budget ranges) */
  function monthShort(ym) { const d = parseISO(ym + '-01'); return MON[d.getMonth()] + ' ' + d.getFullYear(); }

  /** Activity group header: "Today · Tue, 13 Oct", "Yesterday · Mon, 12 Oct", "Sun, 11 Oct". */
  function dayGroupLabel(iso, now) {
    now = now || new Date();
    const d = parseISO(iso);
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return 'Today · ' + dateShort(iso);
    if (sameDay(d, y)) return 'Yesterday · ' + dateShort(iso);
    return dateShort(iso);
  }

  /* ---------- Copy ---------- */

  /** plural(1, 'transaction') -> "1 transaction"; plural(3, ...) -> "3 transactions" */
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }

  /* ---------- Budget status ---------- */

  /**
   * spent, limit in IDR. Returns { key, label, icon, pct, pctLabel, barWidth, over }.
   * Thresholds: < 80% on track, 80-99% near limit, >= 100% over.
   */
  function budgetStatus(spent, limit) {
    const pct = limit > 0 ? spent / limit : 0;
    const p = Math.round(pct * 100);
    let key = 'ok', label = 'On track', icon = 'check_circle';
    if (pct >= 1) { key = 'over'; label = 'Over'; icon = 'error'; }
    else if (pct >= 0.8) { key = 'near'; label = 'Near limit'; icon = 'warning'; }
    return { key: key, label: label, icon: icon, pct: p, pctLabel: label + ' · ' + p + '%',
      barWidth: Math.min(p, 100) + '%', over: pct >= 1, left: Math.max(limit - spent, 0), overBy: Math.max(spent - limit, 0) };
  }

  /* ---------- Budget months ----------
   * A month can start on any day from 1 to 28 (the day money comes in). The
   * month "2026-11" with start day 15 runs from 15 Nov to 14 Dec. With start
   * day 1 everything below matches plain calendar months.
   */

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addMonths(ym, n) { const d = parseISO(ym + '-01'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  const DAY_MS = 864e5;
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY_MS); }

  /** Anything outside 1..28 means the 1st. */
  function startDay(day) {
    const n = Math.floor(Number(day));
    return n >= 1 && n <= 28 ? n : 1;
  }

  /** The month a date counts toward. "2026-11-14" with start day 15 -> "2026-10". */
  function periodOf(iso, day) {
    const s = String(iso || '');
    const ym = s.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return '';
    return Number(s.slice(8, 10)) >= startDay(day) ? ym : addMonths(ym, -1);
  }

  /** First and last date of a month, both included: { start, end } as "YYYY-MM-DD". */
  function periodBounds(ym, day) {
    const sd = startDay(day);
    const end = parseISO(addMonths(ym, 1) + '-' + pad2(sd));
    end.setDate(end.getDate() - 1);
    return { start: ym + '-' + pad2(sd), end: isoOf(end) };
  }

  /** The date of day `i` of a month (0 = first day), "YYYY-MM-DD". */
  function periodDate(ym, day, i) {
    const d = parseISO(periodBounds(ym, day).start);
    d.setDate(d.getDate() + i);
    return isoOf(d);
  }

  /** How far into its month a date is, 0-based. */
  function periodDayIndex(iso, ym, day) { return daysBetween(periodBounds(ym, day).start, String(iso).slice(0, 10)); }

  /** "13 Oct" */
  function dayMonth(iso) { const d = parseISO(iso); return d.getDate() + ' ' + MON[d.getMonth()]; }

  /** "November 2026", or "15 Nov – 14 Dec 2026" when months start later than the 1st. */
  function periodLabel(ym, day) {
    if (startDay(day) === 1) return monthLabel(ym);
    const b = periodBounds(ym, day);
    return b.start.slice(0, 4) === b.end.slice(0, 4)
      ? dayMonth(b.start) + ' – ' + dateLong(b.end)
      : dateLong(b.start) + ' – ' + dateLong(b.end);
  }

  /** For running copy: "November", or "15 Nov – 14 Dec". */
  function periodName(ym, day) {
    if (startDay(day) === 1) return MONTH[parseISO(ym + '-01').getMonth()];
    const b = periodBounds(ym, day);
    return dayMonth(b.start) + ' – ' + dayMonth(b.end);
  }

  /** Position of the "today" tick on progress bars, as a % of the month gone. `day`: month start day (default 1). */
  function monthProgress(ym, now, day) {
    now = now || new Date();
    const b = periodBounds(ym, day);
    const days = daysBetween(b.start, b.end) + 1;
    const today = isoOf(now);
    if (today < b.start || today > b.end) {
      return { pct: today > b.end ? 100 : 0, day: null, days: days, daysLeft: 0 };
    }
    const n = daysBetween(b.start, today) + 1;
    return { pct: Math.round((n / days) * 100), day: n, days: days, daysLeft: days - n + 1 };
  }

  /** 1 -> "1st", 15 -> "15th", 22 -> "22nd" */
  function ordinal(n) {
    const t = n % 100;
    if (t >= 11 && t <= 13) return n + 'th';
    return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  }

  global.TM = {
    rp: rp, rpSigned: rpSigned, rpCompact: rpCompact, heroClass: heroClass,
    titleCase: titleCase, splitDescription: splitDescription, suggestKeyword: suggestKeyword,
    dateLong: dateLong, dateShort: dateShort, dayMonth: dayMonth, monthLabel: monthLabel, monthShort: monthShort, dayGroupLabel: dayGroupLabel,
    plural: plural, ordinal: ordinal, budgetStatus: budgetStatus, monthProgress: monthProgress,
    startDay: startDay, periodOf: periodOf, periodBounds: periodBounds, periodDate: periodDate, periodDayIndex: periodDayIndex,
    periodLabel: periodLabel, periodName: periodName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
