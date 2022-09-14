-- Rabattaktionen for the shop ("kaufen statt leihen").
-- scope: all | publisher | author | isbn, value = publisher / author / isbn (NULL for all)
-- percent: 10 = 10 %. When several rules match, the biggest one wins (no stacking).
CREATE TABLE discount_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  value TEXT,
  percent REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_until TEXT,
  created_at TEXT,
  updated_at TEXT
);

ALTER TABLE order_items ADD COLUMN discount REAL;
