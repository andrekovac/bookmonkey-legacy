// Merkliste (2024). New routes go into routes/ right away, see routes/index.js.
// Mounted in routes.js above requireAdmin, every route needs a login.
const express = require('express');
const db = require('../db');
const auth = require('../lib/auth');
const wishlist = require('../services/wishlist');

const router = express.Router();

function findBook(isbn) {
  return db.open().prepare('SELECT * FROM books WHERE isbn = ?').get(isbn);
}

function sendError(res, err) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'internal error' });
}

router.get('/wishlist', auth.requireLogin, function (req, res) {
  res.json(wishlist.listFor(req.session.uid));
});

// {isbn, note}
router.post('/wishlist', auth.requireLogin, function (req, res) {
  const book = findBook(req.body && req.body.isbn);
  if (!book) return res.status(404).json({ message: 'book not found' });
  try {
    res.status(201).json(wishlist.add(req.session.uid, book, req.body.note));
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/wishlist/:isbn', auth.requireLogin, function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book) return res.status(404).json({ message: 'book not found' });
  try {
    res.json(wishlist.setNote(req.session.uid, book, req.body && req.body.note));
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/wishlist/:isbn', auth.requireLogin, function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book || !wishlist.remove(req.session.uid, book.id)) {
    return res.status(404).json({ message: 'book is not on your list' });
  }
  res.status(204).end();
});

// Merkliste -> Vormerkung
router.post('/wishlist/:isbn/reserve', auth.requireLogin, function (req, res) {
  const book = findBook(req.params.isbn);
  if (!book) return res.status(404).json({ message: 'book not found' });
  try {
    res.status(201).json(wishlist.toReservation(req.session.uid, book, { location: req.body && req.body.location }));
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
