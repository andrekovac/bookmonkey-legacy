-- unique index on books.isbn for faster lookups (detail, cart, loans, reservations all
-- look up books by isbn). Also stops the CSV import from creating the same book twice.
CREATE UNIQUE INDEX IF NOT EXISTS books_isbn_unique ON books (isbn);
