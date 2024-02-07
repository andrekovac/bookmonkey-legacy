-- Merkliste: books somebody wants to read later. Not a reservation, nobody is notified.
CREATE TABLE wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX wishlist_user_book ON wishlist (user_id, book_id);
