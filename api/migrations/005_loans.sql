-- Ausleihe: one row per loan of one copy. returned_at IS NULL means the copy is still out.
CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id INTEGER NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id),
  borrowed_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  returned_at TEXT,
  renewals INTEGER NOT NULL DEFAULT 0,
  checked_out_by INTEGER,
  note TEXT
);

CREATE INDEX idx_loans_user ON loans (user_id);
CREATE INDEX idx_loans_copy ON loans (copy_id);
CREATE INDEX idx_loans_open ON loans (returned_at, due_at);
