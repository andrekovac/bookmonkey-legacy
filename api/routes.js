const express = require('express');
const db = require('./db');
const utils = require('./lib/utils');
const isbnLib = require('./lib/isbn');
const pricing = require('./lib/pricing');
const money = require('./lib/money');
const auth = require('./lib/auth');
const session = require('./lib/session');

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

router.get('/users', function (req, res) {
  const rows = db.open().prepare('SELECT * FROM users ORDER BY id').all();
  res.json(rows.map(auth.publicUser));
});

module.exports = router;
