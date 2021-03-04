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

// GET /api/v1/books?_page=1&_limit=12
router.get('/books', function (req, res) {
  const limit = utils.toInt(req.query._limit, 12);
  const page = utils.toInt(req.query._page, 1);
  const offset = (page - 1) * limit;

  const rows = db.open()
    .prepare('SELECT * FROM books ORDER BY title LIMIT ? OFFSET ?')
    .all(limit, offset);
  res.json(rows.map(toBook));
});

router.get('/books/:isbn', function (req, res) {
  const row = db.open().prepare('SELECT * FROM books WHERE isbn = ?').get(req.params.isbn);
  if (!row) return res.status(404).json({ error: 'book not found' });
  res.json(toBook(row));
});

module.exports = router;
