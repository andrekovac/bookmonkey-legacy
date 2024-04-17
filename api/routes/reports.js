// Berichte (admin). Mounted in routes.js below requireAdmin.
// Behind the flag ENABLE_REPORTS until the library team is happy with the numbers.
const express = require('express');
const flags = require('../lib/flags');
const reports = require('../services/reports');

const router = express.Router();

function sendError(res, err) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'internal error' });
}

router.use('/admin/reports', function (req, res, next) {
  if (!flags.isEnabled('ENABLE_REPORTS')) return res.status(404).json({ message: 'reports are switched off' });
  next();
});

router.get('/admin/reports/summary', function (req, res) {
  res.json(reports.summary());
});

router.get('/admin/reports/loans-per-month', function (req, res) {
  try {
    res.json(reports.loansPerMonth(req.query));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/admin/reports/overdue', function (req, res) {
  res.json(reports.overdue(req.query));
});

router.get('/admin/reports/top-books', function (req, res) {
  try {
    res.json(reports.topBooks(req.query));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/admin/reports/waitlists', function (req, res) {
  res.json(reports.waitlists());
});

module.exports = router;
