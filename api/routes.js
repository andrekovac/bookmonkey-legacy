const express = require('express');
const db = require('./db');
const utils = require('./lib/utils');

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

router.get('/books/:isbn', function (req, res) {
  const row = db.open().prepare('SELECT * FROM books WHERE isbn = ?').get(req.params.isbn);
  if (!row) return res.status(404).json({ error: 'book not found' });
  res.json(toBook(row));
});

module.exports = router;
