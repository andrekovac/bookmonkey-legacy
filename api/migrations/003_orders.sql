CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  status TEXT NOT NULL DEFAULT 'new',
  payment TEXT NOT NULL DEFAULT 'invoice',
  total_net REAL NOT NULL,
  total_gross REAL NOT NULL,
  ship_name TEXT,
  ship_street TEXT,
  ship_zip TEXT,
  ship_city TEXT,
  note TEXT,
  created_at TEXT
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  book_id INTEGER,
  isbn TEXT NOT NULL,
  title TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price_net REAL NOT NULL
);

CREATE INDEX idx_orders_user ON orders (user_id);
