-- Exemplare. One row per physical book on a shelf in one of the company libraries.
-- status: available | on_loan | on_hold | repair | lost
CREATE TABLE copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  barcode TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL DEFAULT 'Hamburg',
  shelf TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  note TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX idx_copies_book ON copies (book_id);
CREATE INDEX idx_copies_status ON copies (status);
