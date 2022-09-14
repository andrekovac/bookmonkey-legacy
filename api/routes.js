const express = require('express');
const db = require('./db');
const utils = require('./lib/utils');
const isbnLib = require('./lib/isbn');
const pricing = require('./lib/pricing');
const money = require('./lib/money');
const auth = require('./lib/auth');
const session = require('./lib/session');
const loans = require('./services/loans');
const mailer = require('./lib/mailer');
const reservations = require('./services/reservations');
const waitlist = require('./services/waitlist');
const overdueJob = require('./jobs/overdue');

const router = express.Router();

function toBook(row) {
  if (!row) return null;
  const price = pricing.forBook(row);
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
    priceGross: price.gross,
    priceGrossRegular: price.grossRegular,
    discount: price.discount,
    discountName: price.discountName,
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
  const out = { isbn: book.isbn, total: total, available: available, locations: rows };
  out.waiting = waitlist.queue(book.id).length;
  // logged in: own loan / reservation for the buttons on the detail page
  if (req.session) {
    const mine = reservations.openFor(req.session.uid, book.id);
    out.myReservation = mine ? reservations.withPosition(waitlist.findReservation(mine.id)) : null;
    out.myLoan = db.open().prepare(`SELECT l.id, l.due_at FROM loans l JOIN copies c ON c.id = l.copy_id
      WHERE l.user_id = ? AND c.book_id = ? AND l.returned_at IS NULL`).get(req.session.uid, book.id) || null;
  }
  res.json(out);
});

// ---------------------------------------------------------------------------
// Rezensionen (reviews)

function reviewsFor(book, uid) {
  const rows = db.open().prepare(`SELECT r.id, r.user_id, r.rating, r.text, r.created_at, r.updated_at, u.name AS user_name
    FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.book_id = ? ORDER BY r.created_at DESC`).all(book.id);
  let sum = 0;
  rows.forEach(function (r) {
    sum += r.rating;
    r.mine = !!uid && r.user_id === uid;
    // only first name + initial, the list is visible for everybody
    if (r.user_name) {
      const parts = r.user_name.split(' ');
      r.user_name = parts[0] + (parts[1] ? ' ' + parts[1].charAt(0) + '.' : '');
    }
    delete r.user_id;
  });
  return {
    average: rows.length ? Math.round((sum / rows.length) * 10) / 10 : null,
    count: rows.length,
    reviews: rows
  };
}

router.get('/books/:isbn/reviews', function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book) return res.status(404).json({ error: 'book not found' });
  res.json(reviewsFor(book, req.session && req.session.uid));
});

// create or replace my review
router.post('/books/:isbn/reviews', auth.requireLogin, function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book) return res.status(404).json({ message: 'book not found' });
  const body = req.body || {};
  const rating = parseInt(body.rating, 10);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'rating must be 1 to 5' });
  const text = body.text ? String(body.text).trim() : null;
  if (text && text.length > 2000) return res.status(400).json({ message: 'text is too long (max 2000)' });

  const conn = db.open();
  const existing = conn.prepare('SELECT id FROM reviews WHERE book_id = ? AND user_id = ?').get(book.id, req.session.uid);
  if (existing) {
    conn.prepare('UPDATE reviews SET rating = ?, text = ?, updated_at = ? WHERE id = ?').run(rating, text, utils.now(), existing.id);
  } else {
    conn.prepare('INSERT INTO reviews (book_id, user_id, rating, text, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(book.id, req.session.uid, rating, text, utils.now());
  }
  res.status(existing ? 200 : 201).json(reviewsFor(book, req.session.uid));
});

router.delete('/reviews/:id', auth.requireLogin, function (req, res) {
  const review = db.open().prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review || (review.user_id !== req.session.uid && req.session.role !== 'admin')) {
    return res.status(404).json({ message: 'review not found' });
  }
  db.open().prepare('DELETE FROM reviews WHERE id = ?').run(review.id);
  res.status(204).end();
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
  const rows = db.open().prepare(`SELECT c.qty, c.added_at, b.id AS book_id, b.isbn, b.title, b.author, b.publisher, b.price, b.currency
    FROM cart_items c JOIN books b ON b.id = c.book_id
    WHERE c.user_id = ? ORDER BY c.id`).all(userId);

  const rules = pricing.activeRules();
  let total = 0;
  const items = rows.map(function (r) {
    const discount = pricing.discountFor(r, rules);
    const net = pricing.discountedNet(r.price, discount);
    const line = pricing.lineGross(net, r.qty);
    total += line;
    return {
      book_id: r.book_id,
      isbn: r.isbn,
      title: r.title,
      author: r.author,
      qty: r.qty,
      price: r.price,
      discount: discount || null,
      price_gross: pricing.gross(net),
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
  order.items = conn.prepare('SELECT isbn, title, qty, price_net, discount FROM order_items WHERE order_id = ? ORDER BY id').all(id);
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
  const rows = conn.prepare(`SELECT c.qty, b.id AS book_id, b.isbn, b.title, b.author, b.publisher, b.price
    FROM cart_items c JOIN books b ON b.id = c.book_id WHERE c.user_id = ?`).all(req.session.uid);
  if (!rows.length) return res.status(400).json({ error: 'cart is empty' });

  // Rabatt pro Position, price_net in order_items is the discounted net
  const rules = pricing.activeRules();
  let totalNet = 0;
  rows.forEach(function (r) {
    r.discount = pricing.discountFor(r, rules);
    r.net = pricing.discountedNet(r.price, r.discount);
    totalNet += r.net * r.qty;
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

    const insertItem = conn.prepare('INSERT INTO order_items (order_id, book_id, isbn, title, qty, price_net, discount) VALUES (?, ?, ?, ?, ?, ?, ?)');
    rows.forEach(function (r) {
      insertItem.run(orderId, r.book_id, r.isbn, r.title, r.qty, r.net, r.discount || null);
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

router.post('/loans/:id/renew', auth.requireLogin, function (req, res) {
  try {
    res.json(loans.renew(req.params.id, req.session.uid));
  } catch (err) {
    sendError(res, err);
  }
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
// Vormerkungen (reservations)

router.get('/reservations', auth.requireLogin, function (req, res) {
  res.json(reservations.listFor(req.session.uid, !!req.query.all));
});

router.post('/reservations', auth.requireLogin, function (req, res) {
  const book = findBook(req.body && req.body.isbn);
  if (!book) return res.status(404).json({ message: 'book not found' });
  try {
    res.status(201).json(reservations.create(req.session.uid, book, { location: req.body.location }));
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/reservations/:id', auth.requireLogin, function (req, res) {
  try {
    res.json(reservations.cancel(req.params.id, req.session.uid, req.session.role === 'admin'));
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
  // back from repair etc. -> maybe somebody is waiting for it
  if (body.status === 'available' && copy.status !== 'available') {
    waitlist.copyReturned(copyRow(copy.id));
  }
  res.json(copyRow(copy.id));
});

router.delete('/admin/copies/:id', function (req, res) {
  const result = db.open().prepare('DELETE FROM copies WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'copy not found' });
  res.status(204).end();
});

// Neuanschaffung: new book + copies in one step (form in the web admin).
// If the book is in the catalogue already, only the copies are added.
router.post('/admin/acquisitions', function (req, res) {
  const body = req.body || {};
  const errors = [];
  if (!isbnLib.isValid(body.isbn)) errors.push('isbn is not valid');
  const count = utils.toInt(body.copies, 1);
  if (count < 1 || count > 20) errors.push('copies must be 1 to 20');
  if (LOCATIONS.indexOf(body.location || 'Hamburg') === -1) errors.push('unknown location');
  if (errors.length) return res.status(400).json({ message: errors.join(', ') });

  const conn = db.open();
  const isbn = isbnLib.format(body.isbn);
  let book = findBook(isbn);
  const isNew = !book;
  if (isNew) {
    if (!body.title || !String(body.title).trim()) return res.status(400).json({ message: 'title is required' });
    conn.prepare(`INSERT INTO books (isbn, title, subtitle, author, publisher, num_pages, published_at, price, currency, co_authors, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EUR', '[]', ?, ?)`).run(
      isbn,
      String(body.title).trim(),
      body.subtitle || null,
      body.author || null,
      body.publisher || null,
      body.numPages ? parseInt(body.numPages, 10) : null,
      body.publishedAt || null,
      body.price !== undefined && body.price !== '' ? money.round(money.parse(body.price)) : null,
      utils.now(),
      utils.now()
    );
    book = findBook(isbn);
  }

  const insert = conn.prepare('INSERT INTO copies (book_id, barcode, location, shelf, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const created = [];
  for (let i = 0; i < count; i++) {
    const max = conn.prepare('SELECT MAX(id) AS max FROM copies').get().max || 0;
    const r = insert.run(book.id, utils.barcode(max + 1), body.location || 'Hamburg', body.shelf || null, 'available', body.note || null, utils.now(), utils.now());
    created.push(copyRow(Number(r.lastInsertRowid)));
  }
  // new copies -> people on the waitlist first
  created.forEach(function (c) {
    if (waitlist.queue(book.id).length) waitlist.copyReturned(c);
  });

  res.status(201).json({ created: isNew, book: toBook(findBook(isbn)), copies: created.map(c => copyRow(c.id)) });
});

// ---------------------------------------------------------------------------
// Rabattregeln (discount rules)

const DISCOUNT_SCOPES = ['all', 'publisher', 'author', 'isbn'];

function validateDiscount(body, isNew) {
  const errors = [];
  if (isNew || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) errors.push('name is required');
  }
  if (isNew || body.scope !== undefined) {
    if (DISCOUNT_SCOPES.indexOf(body.scope) === -1) errors.push('scope must be one of ' + DISCOUNT_SCOPES.join(', '));
    else if (body.scope !== 'all' && !body.value) errors.push('value is required for scope ' + body.scope);
  }
  if (isNew || body.percent !== undefined) {
    const p = money.parse(body.percent);
    // Achtung: mehr als 50 % nur nach Absprache mit der GF, deshalb hart begrenzt
    if (isNaN(p) || p <= 0 || p > 50) errors.push('percent must be between 0 and 50');
  }
  ['valid_from', 'valid_until'].forEach(function (f) {
    if (body[f] && !/^\d{4}-\d{2}-\d{2}$/.test(body[f])) errors.push(f + ' must be YYYY-MM-DD');
  });
  return errors;
}

// how many books does a rule hit, for the admin list
function discountRow(rule) {
  if (!rule) return rule;
  const books = db.open().prepare('SELECT isbn, author, publisher FROM books').all();
  rule.books = books.filter(b => pricing.ruleMatches(rule, b)).length;
  rule.active = !!rule.active;
  return rule;
}

router.get('/admin/discounts', function (req, res) {
  const rows = db.open().prepare('SELECT * FROM discount_rules ORDER BY active DESC, id DESC').all();
  res.json(rows.map(discountRow));
});

router.post('/admin/discounts', function (req, res) {
  const body = req.body || {};
  const errors = validateDiscount(body, true);
  if (errors.length) return res.status(400).json({ message: errors.join(', ') });
  const r = db.open().prepare(`INSERT INTO discount_rules (name, scope, value, percent, active, valid_from, valid_until, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    String(body.name).trim(),
    body.scope,
    body.scope === 'all' ? null : String(body.value).trim(),
    money.parse(body.percent),
    body.active === false ? 0 : 1,
    body.valid_from || null,
    body.valid_until || null,
    utils.now(),
    utils.now()
  );
  res.status(201).json(discountRow(db.open().prepare('SELECT * FROM discount_rules WHERE id = ?').get(Number(r.lastInsertRowid))));
});

router.put('/admin/discounts/:id', function (req, res) {
  const rule = db.open().prepare('SELECT * FROM discount_rules WHERE id = ?').get(req.params.id);
  if (!rule) return res.status(404).json({ message: 'rule not found' });
  const body = req.body || {};
  const errors = validateDiscount(body, false);
  if (errors.length) return res.status(400).json({ message: errors.join(', ') });
  const next = Object.assign({}, rule, body);
  db.open().prepare(`UPDATE discount_rules SET name = ?, scope = ?, value = ?, percent = ?, active = ?, valid_from = ?, valid_until = ?, updated_at = ?
    WHERE id = ?`).run(
    next.name,
    next.scope,
    next.scope === 'all' ? null : next.value,
    money.parse(next.percent),
    next.active === false || next.active === 0 || next.active === '0' ? 0 : 1,
    next.valid_from || null,
    next.valid_until || null,
    utils.now(),
    rule.id
  );
  res.json(discountRow(db.open().prepare('SELECT * FROM discount_rules WHERE id = ?').get(rule.id)));
});

router.delete('/admin/discounts/:id', function (req, res) {
  const result = db.open().prepare('DELETE FROM discount_rules WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: 'rule not found' });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Ausleihe, admin side

// GET /admin/loans?status=open|overdue|returned&q=
router.get('/admin/loans', function (req, res) {
  let sql = `SELECT l.*, c.barcode, c.location, b.isbn, b.title, u.email, u.name AS user_name
    FROM loans l JOIN copies c ON c.id = l.copy_id JOIN books b ON b.id = c.book_id JOIN users u ON u.id = l.user_id`;
  const where = [];
  const params = [];
  if (req.query.status === 'open') where.push('l.returned_at IS NULL');
  if (req.query.status === 'returned') where.push('l.returned_at IS NOT NULL');
  if (req.query.status === 'overdue') {
    where.push('l.returned_at IS NULL AND l.due_at < ?');
    params.push(utils.today());
  }
  if (req.query.q) {
    where.push('(b.title LIKE ? OR u.email LIKE ? OR u.name LIKE ? OR c.barcode = ?)');
    params.push('%' + req.query.q + '%', '%' + req.query.q + '%', '%' + req.query.q + '%', req.query.q);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY l.due_at LIMIT 500';
  res.json(db.open().prepare(sql).all(...params).map(loans.decorate));
});

// Ausleihe an der Theke: {email, barcode}
router.post('/admin/loans', function (req, res) {
  const body = req.body || {};
  const user = auth.findUserByEmail(body.email);
  if (!user) return res.status(404).json({ message: 'user not found' });
  const copy = db.open().prepare('SELECT * FROM copies WHERE barcode = ?').get(String(body.barcode || '').trim().toUpperCase());
  if (!copy) return res.status(404).json({ message: 'copy not found' });
  const book = db.open().prepare('SELECT * FROM books WHERE id = ?').get(copy.book_id);
  try {
    res.status(201).json(loans.borrow(user.id, book, { copyId: copy.id, adminId: req.session.uid }));
  } catch (err) {
    sendError(res, err);
  }
});

// Rückgabe an der Theke / aus der Rückgabebox: {barcode}
router.post('/admin/loans/checkin', function (req, res) {
  const code = String((req.body && req.body.barcode) || '').trim().toUpperCase();
  const open = db.open().prepare(`SELECT l.id FROM loans l JOIN copies c ON c.id = l.copy_id
    WHERE c.barcode = ? AND l.returned_at IS NULL`).get(code);
  if (!open) return res.status(404).json({ message: 'no open loan for ' + code });
  try {
    const loan = loans.giveBack(open.id);
    const copy = copyRow(loan.copy_id);
    // tell the desk if the copy goes to the hold shelf
    const hold = db.open().prepare("SELECT r.id, u.name, u.email FROM reservations r JOIN users u ON u.id = r.user_id WHERE r.copy_id = ? AND r.status = 'ready'").get(loan.copy_id);
    res.json({ loan: loan, copy: copy, hold: hold || null });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/admin/reservations', function (req, res) {
  const opts = { status: req.query.status };
  if (req.query.isbn) {
    const book = findBook(req.query.isbn);
    if (!book) return res.status(404).json({ error: 'book not found' });
    opts.bookId = book.id;
  }
  res.json(reservations.list(opts));
});

router.get('/admin/outbox', function (req, res) {
  res.json(mailer.list({ status: req.query.status, limit: utils.toInt(req.query._limit, 200) }));
});

router.post('/admin/outbox/:id/sent', function (req, res) {
  if (!mailer.markSent(req.params.id)) return res.status(404).json({ error: 'mail not found' });
  res.json({ ok: true });
});

// run the reminder job now instead of waiting for the interval
router.post('/admin/jobs/overdue', function (req, res) {
  res.json(overdueJob.run() || { running: true });
});

module.exports = router;
