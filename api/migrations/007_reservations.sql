-- Vormerkungen / Warteliste
-- status: waiting -> ready (copy is on the hold shelf for 48 h) -> fulfilled
--         or cancelled / expired
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id),
  status TEXT NOT NULL DEFAULT 'waiting',
  copy_id INTEGER REFERENCES copies (id) ON DELETE SET NULL,
  location TEXT,
  created_at TEXT NOT NULL,
  notified_at TEXT,
  expires_at TEXT,
  closed_at TEXT
);

CREATE INDEX idx_reservations_book ON reservations (book_id, status);
CREATE INDEX idx_reservations_user ON reservations (user_id);
