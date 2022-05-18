-- Rezensionen, one per user and book
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id),
  rating INTEGER NOT NULL,
  text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE UNIQUE INDEX idx_reviews_book_user ON reviews (book_id, user_id);
