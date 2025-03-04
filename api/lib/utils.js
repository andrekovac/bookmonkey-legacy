// small helpers that did not fit anywhere else

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

// "2021-03-04 15:40:12", local time of the server (shop is in Germany)
function now() {
  return stamp(new Date());
}

function stamp(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

// "2022-01-10" (local)
function today() {
  return now().slice(0, 10);
}

// today + n days as "YYYY-MM-DD", n can be negative
function addDays(n, from) {
  const d = from ? new Date(from.slice(0, 10) + 'T12:00:00') : new Date();
  d.setDate(d.getDate() + n);
  return stamp(d).slice(0, 10);
}

// copies get a printed label "BM-00042"
function barcode(n) {
  let s = String(n);
  while (s.length < 5) s = '0' + s;
  return 'BM-' + s;
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

// "numPages" -> "num_pages". Everything else is returned as it is
// (snake_case column names are fine already)
function toSnake(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(v)) return v.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  return v;
}

// ISO week (Monday is the first day) as a number, 2025-03-10 -> 202511. Used as ref_id for
// mails that go out once per week.
function weekKey(from) {
  const d = from ? new Date(from.slice(0, 10) + 'T12:00:00') : new Date();
  const day = (d.getDay() + 6) % 7; // Mon 0 .. Sun 6
  d.setDate(d.getDate() - day + 3); // Thursday of this week decides the year
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4, 12);
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return year * 100 + week;
}

module.exports = { now, stamp, today, addDays, barcode, pad, toInt, parseJson, toSnake, weekKey };
