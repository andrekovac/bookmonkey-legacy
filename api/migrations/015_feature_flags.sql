-- Feature flags. Code knows every flag and its default (lib/flags.js), a row here overrides it.
-- Env FLAG_<NAME>=on|off overrides both (e.g. to switch something off on one instance).
CREATE TABLE feature_flags (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  updated_at TEXT,
  updated_by INTEGER REFERENCES users (id) ON DELETE SET NULL
);
