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

module.exports = { now, stamp, today, addDays, barcode, pad, toInt, parseJson };
