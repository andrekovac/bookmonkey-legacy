// Export v2 (2025): reviews and loans as CSV for the admin.
// New routes go into routes/ right away, see routes/index.js.
const express = require('express');
const auth = require('../lib/auth');
const csv = require('../lib/csv');
const utils = require('../lib/utils');
const exporter = require('../services/export');

const router = express.Router();

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /admin/export/reviews.csv?isbn=...&min=1&max=2
router.get('/admin/export/reviews.csv', auth.requireLogin, function (req, res) {
  const rows = exporter.reviews({
    isbn: req.query.isbn,
    minRating: utils.toInt(req.query.min, null),
    maxRating: utils.toInt(req.query.max, null)
  });
  csv.send(res, exporter.filename('rezensionen'), rows, exporter.REVIEW_COLUMNS);
});

// GET /admin/export/loans.csv?from=2025-01-01&to=2025-06-30&location=Hamburg&open=1
router.get('/admin/export/loans.csv', auth.requireLogin, function (req, res) {
  const from = req.query.from;
  const to = req.query.to;
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
    return res.status(400).json({ message: 'from and to must be YYYY-MM-DD' });
  }
  const rows = exporter.loans({ from: from, to: to, location: req.query.location, open: !!req.query.open });
  csv.send(res, exporter.filename('ausleihen'), rows, exporter.LOAN_COLUMNS);
});

module.exports = router;
