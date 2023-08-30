// Tiny in-memory cache for GET responses that are expensive to build
// (book list: pricing + discount rules for every row). Per process, no invalidation yet.
const DEFAULT_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 500;

const entries = new Map();
let hits = 0;
let misses = 0;

function get(key) {
  const entry = entries.get(key);
  if (!entry) {
    misses++;
    return undefined;
  }
  if (entry.expires < Date.now()) {
    entries.delete(key);
    misses++;
    return undefined;
  }
  hits++;
  return entry.value;
}

function set(key, value, ttlMs) {
  if (entries.size >= MAX_ENTRIES) {
    // drop the oldest one (Map keeps insertion order)
    entries.delete(entries.keys().next().value);
  }
  entries.set(key, { value: value, expires: Date.now() + (ttlMs || DEFAULT_TTL_MS) });
}

function clear() {
  entries.clear();
}

function stats() {
  return { size: entries.size, hits: hits, misses: misses };
}

// express middleware for json GET routes: cache.json(60000)
function json(ttlMs) {
  return function (req, res, next) {
    if (req.method !== 'GET' || process.env.NODE_ENV === 'test') return next();
    const key = req.originalUrl;
    const cached = get(key);
    if (cached !== undefined) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    const send = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode === 200) set(key, body, ttlMs);
      res.set('X-Cache', 'MISS');
      return send(body);
    };
    next();
  };
}

module.exports = { get, set, clear, stats, json };
