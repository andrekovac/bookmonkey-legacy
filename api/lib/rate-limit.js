// Login throttle (2025, after the pentest of the intranet apps): after MAX_FAILS wrong
// passwords for one e-mail from one address, logins are blocked for BLOCK_MINUTES.
// In memory, so a restart clears it. Good enough for one office server.
const MAX_FAILS = parseInt(process.env.LOGIN_MAX_FAILS, 10) || 5;
const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;

const entries = new Map();

function keyFor(email, ip) {
  return String(email || '').trim().toLowerCase() + '|' + (ip || '');
}

// seconds until the next try is allowed, 0 = go ahead
function blockedFor(key, now) {
  now = now || Date.now();
  const e = entries.get(key);
  if (!e || !e.until) return 0;
  if (e.until <= now) {
    entries.delete(key);
    return 0;
  }
  return Math.ceil((e.until - now) / 1000);
}

function fail(key, now) {
  now = now || Date.now();
  let e = entries.get(key);
  if (!e || now - e.first > WINDOW_MINUTES * 60 * 1000) {
    e = { count: 0, first: now, until: null };
    entries.set(key, e);
  }
  e.count++;
  if (e.count >= MAX_FAILS) e.until = now + BLOCK_MINUTES * 60 * 1000;
  return e.count;
}

function reset(key) {
  entries.delete(key);
}

// old entries are removed now and then, so the map does not grow forever
function sweep(now) {
  now = now || Date.now();
  entries.forEach(function (e, key) {
    const end = e.until || e.first + WINDOW_MINUTES * 60 * 1000;
    if (end <= now) entries.delete(key);
  });
}
setInterval(sweep, 10 * 60 * 1000).unref();

module.exports = { keyFor, blockedFor, fail, reset, sweep, MAX_FAILS, BLOCK_MINUTES };
