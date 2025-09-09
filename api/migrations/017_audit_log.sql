-- Änderungsprotokoll (2025): who changed what in the admin. Written by lib/audit.js.
-- details is JSON (changed fields, old/new values where it is cheap to get them).
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id);
CREATE INDEX idx_audit_created ON audit_log (created_at);
