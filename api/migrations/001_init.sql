CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  co_authors TEXT,
  publisher TEXT,
  abstract TEXT,
  num_pages INTEGER,
  published_at TEXT,
  price REAL,
  currency TEXT DEFAULT 'EUR',
  predecessor_isbn TEXT,
  successor_isbn TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX idx_books_publisher ON books (publisher);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT
);
