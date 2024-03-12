// Feature flags (2024).
//
//   const flags = require('./lib/flags');
//   if (flags.isEnabled('ENABLE_REPORTS')) { ... }
//
// Order: env FLAG_<NAME>=on|off  >  row in feature_flags  >  DEFAULTS below.
// Values are cached for a few seconds because isEnabled() is called on every request.
const db = require('../db');
const utils = require('./utils');

// every flag the code knows about. Unknown names are rejected by set().
const DEFAULTS = {
  ENABLE_REPORTS: { enabled: false, description: 'Berichte im Admin (Ausleihen pro Monat, Überfällige, Top-Bücher)' }
};

const CACHE_MS = 5000;
let cache = null;
let cachedAt = 0;

function envValue(name) {
  const raw = process.env['FLAG_' + name];
  if (raw === undefined || raw === '') return undefined;
  return ['1', 'on', 'true', 'yes'].indexOf(String(raw).toLowerCase()) !== -1;
}

function rows() {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;
  const out = {};
  db.open().prepare('SELECT * FROM feature_flags').all().forEach(function (r) {
    out[r.name] = r;
  });
  cache = out;
  cachedAt = Date.now();
  return out;
}

function clearCache() {
  cache = null;
  cachedAt = 0;
}

function known(name) {
  return Object.prototype.hasOwnProperty.call(DEFAULTS, name);
}

function describe(name) {
  const row = rows()[name];
  const env = envValue(name);
  const def = DEFAULTS[name] || { enabled: false, description: null };
  let enabled = def.enabled;
  let source = 'default';
  if (row) {
    enabled = !!row.enabled;
    source = 'db';
  }
  if (env !== undefined) {
    enabled = env;
    source = 'env';
  }
  return {
    name: name,
    enabled: enabled,
    source: source,
    description: (row && row.description) || def.description,
    updatedAt: row ? row.updated_at : null,
    updatedBy: row ? row.updated_by : null
  };
}

function isEnabled(name) {
  return describe(name).enabled;
}

// all known flags plus rows for flags the code does not know (any more)
function list() {
  const names = Object.keys(DEFAULTS);
  Object.keys(rows()).forEach(function (name) {
    if (names.indexOf(name) === -1) names.push(name);
  });
  return names.sort().map(describe);
}

// { ENABLE_REPORTS: false, ... } for the web app
function publicFlags() {
  const out = {};
  list().forEach(function (f) {
    out[f.name] = f.enabled;
  });
  return out;
}

function set(name, enabled, userId) {
  if (!known(name)) {
    const err = new Error('unknown flag ' + name);
    err.status = 404;
    throw err;
  }
  db.open().prepare(`INSERT INTO feature_flags (name, enabled, description, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (name) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(name, enabled ? 1 : 0, DEFAULTS[name].description, utils.now(), userId || null);
  clearCache();
  return describe(name);
}

module.exports = { DEFAULTS, isEnabled, describe, list, publicFlags, set, clearCache };
