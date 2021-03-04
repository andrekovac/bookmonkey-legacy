// small helpers that did not fit anywhere else

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

// "2021-03-04 15:40:12", local time of the server (shop is in Germany)
function now() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
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

module.exports = { now, pad, toInt, parseJson };
