// Stateless sessions: the user id and role live in a signed cookie.
// cookie value = base64url(json) + "." + hmac
const crypto = require('crypto');

// TODO: move to env before going live
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me-2021';

const COOKIE_NAME = 'bm_session';
const MAX_AGE = 14 * 24 * 60 * 60 * 1000; // 14 days

function hmac(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + hmac(body);
}

function verify(token) {
  if (!token || token.indexOf('.') === -1) return null;
  const parts = token.split('.');
  const body = parts[0];
  const sig = parts[1];
  const expected = hmac(body);
  if (!sig || sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(function (part) {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch (e) {
      out[key] = value;
    }
  });
  return out;
}

// express middleware, sets req.session (or null)
function middleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  req.session = verify(cookies[COOKIE_NAME]);
  next();
}

function start(res, user) {
  const token = sign({ uid: user.id, role: user.role, exp: Date.now() + MAX_AGE });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/'
  });
}

function destroy(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = {
  COOKIE_NAME,
  sign,
  verify,
  parseCookies,
  middleware,
  start,
  destroy
};
