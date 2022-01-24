const express = require('express');
const db = require('./db');
const utils = require('./lib/utils');
const isbnLib = require('./lib/isbn');
const pricing = require('./lib/pricing');
const money = require('./lib/money');
const auth = require('./lib/auth');
const session = require('./lib/session');
const loans = require('./services/loans');

const router = express.Router();

function toBook(row) {
  if (!row) return null;
  return {
    isbn: row.isbn,
    title: row.title,
    subtitle: row.subtitle,
    author: row.author,
    coAuthors: utils.parseJson(row.co_authors, []),
    publisher: row.publisher,
    abstract: row.abstract,
    numPages: row.num_pages,
    publishedAt: row.published_at,
    price: row.price,
    priceGross: pricing.gross(row.price),
    currency: row.currency,
    predecessorIsbn: row.predecessor_isbn,
    successorIsbn: row.successor_isbn,
    cover: '/covers/' + row.isbn.replace(/-/g, '') + '.png'
  };
}

const SORT_COLUMNS = {
  title: 'title',
  author: 'author',
  price: 'price',
  published: 'published_at',
  publisher: 'publisher'
};

// GET /api/v1/books?q=potter&publisher=Bloomsbury&sort=price&order=desc&_page=1&_limit=12
router.get('/books', function (req, res) {
  const limit = utils.toInt(req.query._limit, 12);
  const page = utils.toInt(req.query._page, 1);
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(title LIKE ? OR author LIKE ?)');
    params.push('%' + req.query.q + '%', '%' + req.query.q + '%');
  }
  if (req.query.publisher) {
    where.push('publisher = ?');
    params.push(req.query.publisher);
  }

  const sort = SORT_COLUMNS[req.query.sort] || 'title';
  const order = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  let sql = 'SELECT * FROM books';
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY ' + sort + ' ' + order + ', id LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.open().prepare(sql).all(...params);
  res.json(rows.map(toBook));
});

router.get('/publishers', function (req, res) {
  const rows = db.open()
    .prepare('SELECT publisher, COUNT(*) AS count FROM books WHERE publisher IS NOT NULL GROUP BY publisher ORDER BY publisher')
    .all();
  res.json(rows);
});

function findBook(isbn) {
  return db.open().prepare('SELECT * FROM books WHERE isbn = ?').get(isbn);
}

router.get('/books/:isbn', function (req, res) {
  const row = findBook(req.params.isbn);
  if (!row) return res.status(404).json({ error: 'book not found' });
  res.json(toBook(row));
});

// whole series of a book, in reading order
// { position: 2, total: 3, books: [{isbn, title}, ...] }
router.get('/books/:isbn/series', function (req, res) {
  const start = findBook(req.params.isbn);
  if (!start) return res.status(404).json({ error: 'book not found' });

  const seen = {};
  let first = start;
  // walk back to the first volume (max 50, in case somebody built a loop in the admin)
  for (let i = 0; i < 50 && first.predecessor_isbn; i++) {
    const prev = findBook(first.predecessor_isbn);
    if (!prev || seen[prev.isbn]) break;
    seen[prev.isbn] = true;
    first = prev;
  }

  const books = [];
  let current = first;
  const visited = {};
  while (current && !visited[current.isbn] && books.length < 50) {
    visited[current.isbn] = true;
    books.push({ isbn: current.isbn, title: current.title });
    current = current.successor_isbn ? findBook(current.successor_isbn) : null;
  }

  let position = 0;
  books.forEach(function (b, idx) {
    if (b.isbn === start.isbn) position = idx + 1;
  });

  res.json({ position: position, total: books.length, books: books });
});

// how many copies are on the shelf, per location
// { total: 3, available: 1, locations: [{location: 'Hamburg', total: 2, available: 1}] }
router.get('/books/:isbn/availability', function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book) return res.status(404).json({ error: 'book not found' });
  const rows = db.open().prepare(`SELECT location,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available
    FROM copies WHERE book_id = ? AND status NOT IN ('lost') GROUP BY location ORDER BY location`).all(book.id);
  let total = 0;
  let available = 0;
  rows.forEach(function (r) {
    total += r.total;
    available += r.available;
  });
  res.json({ isbn: book.isbn, total: total, available: available, locations: rows });
});

// ---------------------------------------------------------------------------
// auth

router.post('/auth/login', function (req, res) {
  const email = req.body && req.body.email;
  const password = req.body && req.body.password;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  const user = auth.findUserByEmail(email);
  if (!user || !auth.checkPassword(password, user.password)) {
    return res.status(401).json({ error: 'wrong email or password' });
  }
  session.start(res, user);
  res.json(auth.publicUser(user));
});

router.post('/auth/register', function (req, res) {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const errors = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('email is not valid');
  if (!body.password || String(body.password).length < 6) errors.push('password needs at least 6 characters');
  if (body.name && String(body.name).length > 80) errors.push('name is too long');
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  if (auth.findUserByEmail(email)) {
    return res.status(409).json({ error: 'email is already registered' });
  }
  const result = db.open()
    .prepare("INSERT INTO users (email, password, name, role, created_at) VALUES (?, ?, ?, 'customer', ?)")
    .run(email, auth.hashPassword(body.password), body.name || null, utils.now());
  const user = auth.findUser(Number(result.lastInsertRowid));
  session.start(res, user);
  res.status(201).json(auth.publicUser(user));
});

router.post('/auth/logout', function (req, res) {
  session.destroy(res);
  res.json({ ok: true });
});

router.get('/auth/me', function (req, res) {
  if (!req.session) return res.status(401).json({ error: 'not logged in' });
  const user = auth.findUser(req.session.uid);
  if (!user) {
    session.destroy(res);
    return res.status(401).json({ error: 'not logged in' });
  }
  res.json(auth.publicUser(user));
});

// change own name / password
router.put('/auth/me', auth.requireLogin, function (req, res) {
  const user = auth.findUser(req.session.uid);
  if (!user) return res.status(401).json({ error: 'not logged in' });
  const body = req.body || {};

  if (body.password) {
    if (!body.currentPassword || !auth.checkPassword(body.currentPassword, user.password)) {
      return res.status(400).json({ error: 'current password is wrong' });
    }
    if (String(body.password).length < 6) {
      return res.status(400).json({ error: 'password needs at least 6 characters' });
    }
    db.open().prepare('UPDATE users SET password = ? WHERE id = ?').run(auth.hashPassword(body.password), user.id);
  }
  if (body.name !== undefined) {
    db.open().prepare('UPDATE users SET name = ? WHERE id = ?').run(String(body.name).slice(0, 80), user.id);
  }
  res.json(auth.publicUser(auth.findUser(user.id)));
});

// ---------------------------------------------------------------------------
// cart

function cartFor(userId) {
  const rows = db.open().prepare(`SELECT c.qty, c.added_at, b.id AS book_id, b.isbn, b.title, b.author, b.price, b.currency
    FROM cart_items c JOIN books b ON b.id = c.book_id
    WHERE c.user_id = ? ORDER BY c.id`).all(userId);

  let total = 0;
  const items = rows.map(function (r) {
    const line = pricing.lineGross(r.price, r.qty);
    total += line;
    return {
      book_id: r.book_id,
      isbn: r.isbn,
      title: r.title,
      author: r.author,
      qty: r.qty,
      price: r.price,
      price_gross: pricing.gross(r.price),
      line_total: line,
      currency: r.currency,
      added_at: r.added_at
    };
  });
  return { items: items, count: items.reduce((n, i) => n + i.qty, 0), total: money.round(total) };
}

router.get('/cart', auth.requireLogin, function (req, res) {
  res.json(cartFor(req.session.uid));
});

router.post('/cart', auth.requireLogin, function (req, res) {
  const book = findBook(req.body.isbn);
  if (!book) return res.status(404).json({ error: 'book not found' });
  const qty = Math.max(1, utils.toInt(req.body.qty, 1));
  const conn = db.open();
  const existing = conn.prepare('SELECT * FROM cart_items WHERE user_id = ? AND book_id = ?').get(req.session.uid, book.id);
  if (existing) {
    conn.prepare('UPDATE cart_items SET qty = qty + ? WHERE id = ?').run(qty, existing.id);
  } else {
    conn.prepare('INSERT INTO cart_items (user_id, book_id, qty, added_at) VALUES (?, ?, ?, ?)')
      .run(req.session.uid, book.id, qty, utils.now());
  }
  res.status(201).json(cartFor(req.session.uid));
});

router.put('/cart/:isbn', auth.requireLogin, function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book) return res.status(404).json({ error: 'book not found' });
  const qty = utils.toInt(req.body.qty, 1);
  const conn = db.open();
  if (qty <= 0) {
    conn.prepare('DELETE FROM cart_items WHERE user_id = ? AND book_id = ?').run(req.session.uid, book.id);
  } else {
    conn.prepare('UPDATE cart_items SET qty = ? WHERE user_id = ? AND book_id = ?').run(qty, req.session.uid, book.id);
  }
  res.json(cartFor(req.session.uid));
});

router.delete('/cart/:isbn', auth.requireLogin, function (req, res) {
  const book = findBook(req.params.isbn);
  if (book) {
    db.open().prepare('DELETE FROM cart_items WHERE user_id = ? AND book_id = ?').run(req.session.uid, book.id);
  }
  res.json(cartFor(req.session.uid));
});

// ---------------------------------------------------------------------------
// orders

const PAYMENT_TYPES = ['invoice', 'prepayment'];

function loadOrder(id) {
  const conn = db.open();
  const order = conn.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = conn.prepare('SELECT isbn, title, qty, price_net FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  return order;
}

router.post('/orders', auth.requireLogin, function (req, res) {
  const body = req.body || {};
  const errors = [];
  if (!body.name) errors.push('name is required');
  if (!body.street) errors.push('street is required');
  if (!/^[0-9]{5}$/.test(String(body.zip || ''))) errors.push('zip must have 5 digits');
  if (!body.city) errors.push('city is required');
  const payment = body.payment || 'invoice';
  if (PAYMENT_TYPES.indexOf(payment) === -1) errors.push('unknown payment type');
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const conn = db.open();
  const rows = conn.prepare(`SELECT c.qty, b.id AS book_id, b.isbn, b.title, b.price
    FROM cart_items c JOIN books b ON b.id = c.book_id WHERE c.user_id = ?`).all(req.session.uid);
  if (!rows.length) return res.status(400).json({ error: 'cart is empty' });

  let totalNet = 0;
  rows.forEach(function (r) {
    totalNet += r.price * r.qty;
  });
  totalNet = money.round(totalNet);
  const totalGross = pricing.gross(totalNet);

  let orderId;
  conn.exec('BEGIN');
  try {
    const result = conn.prepare(`INSERT INTO orders
      (user_id, status, payment, total_net, total_gross, ship_name, ship_street, ship_zip, ship_city, note, created_at)
      VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.session.uid, payment, totalNet, totalGross, body.name, body.street, String(body.zip), body.city, body.note || null, utils.now());
    orderId = Number(result.lastInsertRowid);

    const insertItem = conn.prepare('INSERT INTO order_items (order_id, book_id, isbn, title, qty, price_net) VALUES (?, ?, ?, ?, ?, ?)');
    rows.forEach(function (r) {
      insertItem.run(orderId, r.book_id, r.isbn, r.title, r.qty, r.price);
    });
    conn.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.session.uid);
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    console.error('checkout failed', err);
    return res.status(500).json({ error: 'could not place order' });
  }

  res.status(201).json(loadOrder(orderId));
});

router.get('/orders', auth.requireLogin, function (req, res) {
  const rows = db.open()
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.uid);
  res.json(rows);
});

router.get('/orders/:id', auth.requireLogin, function (req, res) {
  const order = loadOrder(req.params.id);
  if (!order || (order.user_id !== req.session.uid && req.session.role !== 'admin')) {
    return res.status(404).json({ error: 'order not found' });
  }
  res.json(order);
});

// ---------------------------------------------------------------------------
// Ausleihe (loans)

// errors from services/* have a status, everything else is a 500
function sendError(res, err) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'internal error' });
}

// my loans. ?history=1 also returns the returned ones
router.get('/loans', auth.requireLogin, function (req, res) {
  const rows = req.query.history ? loans.historyFor(req.session.uid) : loans.openLoansFor(req.session.uid);
  res.json(rows.map(loans.decorate));
});

router.post('/loans', auth.requireLogin, function (req, res) {
  const book = findBook(req.body && req.body.isbn);
  if (!book) return res.status(404).json({ message: 'book not found' });
  try {
    const loan = loans.borrow(req.session.uid, book, { location: req.body.location });
    res.status(201).json(loan);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/loans/:id', auth.requireLogin, function (req, res) {
  const loan = loans.findLoan(req.params.id);
  if (!loan) return res.status(404).json({ message: 'loan not found' });
  res.json(loans.decorate(loan));
});

// self service return (drop box next to the shelf)
router.post('/loans/:id/return', auth.requireLogin, function (req, res) {
  const loan = loans.findLoan(req.params.id);
  if (!loan || (loan.user_id !== req.session.uid && req.session.role !== 'admin')) {
    return res.status(404).json({ message: 'loan not found' });
  }
  try {
    res.json(loans.giveBack(loan.id));
  } catch (err) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// admin, everything below needs an admin session

router.use(auth.requireAdmin);

// request field -> column
const BOOK_FIELDS = {
  title: 'title',
  subtitle: 'subtitle',
  author: 'author',
  coAuthors: 'co_authors',
  publisher: 'publisher',
  abstract: 'abstract',
  numPages: 'num_pages',
  publishedAt: 'published_at',
  price: 'price',
  currency: 'currency',
  predecessorIsbn: 'predecessor_isbn',
  successorIsbn: 'successor_isbn'
};

function validateBook(body, isNew) {
  const errors = [];
  if (isNew || body.title !== undefined) {
    if (!body.title || !String(body.title).trim()) errors.push('title is required');
    else if (String(body.title).length > 100) errors.push('title is too long (max 100)');
  }
  if (isNew && !isbnLib.isValid(body.isbn)) errors.push('isbn is not valid');
  if (body.price !== undefined && body.price !== null && body.price !== '') {
    if (isNaN(money.parse(body.price)) || money.parse(body.price) < 0) errors.push('price must be a positive number');
  }
  if (body.numPages !== undefined && body.numPages !== null && body.numPages !== '') {
    if (isNaN(parseInt(body.numPages, 10))) errors.push('numPages must be a number');
  }
  return errors;
}

function columnValue(field, value) {
  if (value === '' || value === undefined) return null;
  switch (field) {
    case 'coAuthors':
      return JSON.stringify(Array.isArray(value) ? value : String(value).split(',').map(s => s.trim()).filter(Boolean));
    case 'numPages':
      return parseInt(value, 10);
    case 'price':
      return money.round(money.parse(value));
    case 'predecessorIsbn':
    case 'successorIsbn':
      return isbnLib.format(value);
    default:
      return value;
  }
}

router.post('/books', function (req, res) {
  const body = req.body || {};
  const errors = validateBook(body, true);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const isbn = isbnLib.format(body.isbn);
  if (findBook(isbn)) return res.status(409).json({ error: 'book with this isbn exists already' });

  const columns = ['isbn', 'created_at', 'updated_at'];
  const values = [isbn, utils.now(), utils.now()];
  Object.keys(BOOK_FIELDS).forEach(function (field) {
    if (body[field] === undefined) return;
    columns.push(BOOK_FIELDS[field]);
    values.push(columnValue(field, body[field]));
  });

  db.open()
    .prepare('INSERT INTO books (' + columns.join(', ') + ') VALUES (' + columns.map(() => '?').join(', ') + ')')
    .run(...values);
  res.status(201).json(toBook(findBook(isbn)));
});

router.put('/books/:isbn', function (req, res) {
  const existing = findBook(req.params.isbn);
  if (!existing) return res.status(404).json({ error: 'book not found' });

  const body = req.body || {};
  const errors = validateBook(body, false);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const sets = [];
  const values = [];
  Object.keys(BOOK_FIELDS).forEach(function (field) {
    if (body[field] === undefined) return;
    sets.push(BOOK_FIELDS[field] + ' = ?');
    values.push(columnValue(field, body[field]));
  });
  if (!sets.length) return res.json(toBook(existing));

  sets.push('updated_at = ?');
  values.push(utils.now());
  values.push(existing.id);
  db.open().prepare('UPDATE books SET ' + sets.join(', ') + ' WHERE id = ?').run(...values);
  res.json(toBook(findBook(existing.isbn)));
});

router.delete('/books/:isbn', function (req, res) {
  const result = db.open().prepare('DELETE FROM books WHERE isbn = ?').run(req.params.isbn);
  if (!result.changes) return res.status(404).json({ error: 'book not found' });
  res.status(204).end();
});

router.get('/admin/orders', function (req, res) {
  let sql = `SELECT o.*, u.email, (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id) AS item_count
    FROM orders o JOIN users u ON u.id = o.user_id`;
  const params = [];
  if (req.query.status) {
    sql += ' WHERE o.status = ?';
    params.push(req.query.status);
  }
  sql += ' ORDER BY o.id DESC';
  res.json(db.open().prepare(sql).all(...params));
});

const ORDER_STATUS = ['new', 'paid', 'shipped', 'cancelled'];

router.put('/admin/orders/:id', function (req, res) {
  const status = req.body && req.body.status;
  if (ORDER_STATUS.indexOf(status) === -1) {
    return res.status(400).json({ error: 'status must be one of ' + ORDER_STATUS.join(', ') });
  }
  const result = db.open().prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'order not found' });
  res.json(loadOrder(req.params.id));
});

router.get('/users', function (req, res) {
  const rows = db.open().prepare('SELECT * FROM users ORDER BY id').all();
  res.json(rows.map(auth.publicUser));
});

// ---------------------------------------------------------------------------
// Exemplare (copies), admin only

const COPY_STATUS = ['available', 'on_loan', 'on_hold', 'repair', 'lost'];
const LOCATIONS = ['Hamburg', 'Berlin', 'München'];

function copyRow(id) {
  return db.open().prepare(`SELECT c.*, b.isbn, b.title FROM copies c JOIN books b ON b.id = c.book_id WHERE c.id = ?`).get(id);
}

// GET /admin/copies?isbn=...&status=...&location=...
router.get('/admin/copies', function (req, res) {
  let sql = 'SELECT c.*, b.isbn, b.title, b.author FROM copies c JOIN books b ON b.id = c.book_id';
  const where = [];
  const params = [];
  if (req.query.isbn) {
    where.push('b.isbn = ?');
    params.push(req.query.isbn);
  }
  if (req.query.status) {
    where.push('c.status = ?');
    params.push(req.query.status);
  }
  if (req.query.location) {
    where.push('c.location = ?');
    params.push(req.query.location);
  }
  if (req.query.q) {
    where.push('(b.title LIKE ? OR c.barcode LIKE ?)');
    params.push('%' + req.query.q + '%', '%' + req.query.q + '%');
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY b.title, c.barcode LIMIT 500';
  res.json(db.open().prepare(sql).all(...params));
});

router.post('/admin/books/:isbn/copies', function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book) return res.status(404).json({ error: 'book not found' });
  const body = req.body || {};
  const location = body.location || 'Hamburg';
  if (LOCATIONS.indexOf(location) === -1) return res.status(400).json({ error: 'unknown location' });
  const count = Math.min(20, Math.max(1, utils.toInt(body.count, 1)));

  const conn = db.open();
  const insert = conn.prepare('INSERT INTO copies (book_id, barcode, location, shelf, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const created = [];
  for (let i = 0; i < count; i++) {
    // barcode: next free number. Achtung: printed labels exist for BM-00001..BM-00200 already
    const max = conn.prepare('SELECT MAX(id) AS max FROM copies').get().max || 0;
    const code = body.barcode && count === 1 ? String(body.barcode).trim() : utils.barcode(max + 1);
    if (conn.prepare('SELECT id FROM copies WHERE barcode = ?').get(code)) {
      return res.status(409).json({ error: 'barcode exists already: ' + code });
    }
    const r = insert.run(book.id, code, location, body.shelf || null, 'available', body.note || null, utils.now(), utils.now());
    created.push(copyRow(Number(r.lastInsertRowid)));
  }
  res.status(201).json(created);
});

router.put('/admin/copies/:id', function (req, res) {
  const copy = copyRow(req.params.id);
  if (!copy) return res.status(404).json({ error: 'copy not found' });
  const body = req.body || {};
  if (body.status !== undefined && COPY_STATUS.indexOf(body.status) === -1) {
    return res.status(400).json({ error: 'status must be one of ' + COPY_STATUS.join(', ') });
  }
  if (body.location !== undefined && LOCATIONS.indexOf(body.location) === -1) {
    return res.status(400).json({ error: 'unknown location' });
  }
  db.open().prepare('UPDATE copies SET status = ?, location = ?, shelf = ?, note = ?, updated_at = ? WHERE id = ?').run(
    body.status !== undefined ? body.status : copy.status,
    body.location !== undefined ? body.location : copy.location,
    body.shelf !== undefined ? body.shelf : copy.shelf,
    body.note !== undefined ? body.note : copy.note,
    utils.now(),
    copy.id
  );
  res.json(copyRow(copy.id));
});

router.delete('/admin/copies/:id', function (req, res) {
  const result = db.open().prepare('DELETE FROM copies WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'copy not found' });
  res.status(204).end();
});

module.exports = router;
