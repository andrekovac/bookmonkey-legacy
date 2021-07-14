CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  added_at TEXT
);

CREATE UNIQUE INDEX idx_cart_user_book ON cart_items (user_id, book_id);
