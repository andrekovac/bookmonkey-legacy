const express = require('express');
const db = require('./db');
const utils = require('./lib/utils');
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

module.exports = router;
