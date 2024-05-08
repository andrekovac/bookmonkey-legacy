// Berichte (admin). Mounted in routes.js below requireAdmin.
// Behind the flag ENABLE_REPORTS until the library team is happy with the numbers.
// Every report also comes as CSV: ?format=csv
const express = require('express');
const flags = require('../lib/flags');
const csv = require('../lib/csv');
const utils = require('../lib/utils');
const reports = require('../services/reports');

const router = express.Router();

function sendError(res, err) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'internal error' });
}

function wantsCsv(req) {
  return req.query.format === 'csv';
}

function filename(name) {
  return 'bookmonkey-' + name + '-' + utils.today() + '.csv';
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
    const data = reports.loansPerMonth(req.query);
    if (!wantsCsv(req)) return res.json(data);
    const columns = [{ key: 'month', label: 'Monat' }, { key: 'loans', label: 'Ausleihen' }, { key: 'returned', label: 'zurück' }]
      .concat(data.locations.map(l => ({ key: r => r[l] || 0, label: l })));
    csv.send(res, filename('ausleihen-pro-monat'), data.rows, columns);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/admin/reports/overdue', function (req, res) {
  const rows = reports.overdue(req.query);
  if (!wantsCsv(req)) return res.json(rows);
  csv.send(res, filename('ueberfaellig'), rows, [
    { key: 'title', label: 'Titel' },
    { key: 'barcode', label: 'Exemplar' },
    { key: 'location', label: 'Standort' },
    { key: 'user_name', label: 'Name' },
    { key: 'email', label: 'E-Mail' },
    { key: 'department', label: 'Abteilung' },
    { key: 'due_at', label: 'fällig' },
    { key: 'days_overdue', label: 'Tage überfällig' },
    { key: 'reminder_count', label: 'Erinnerungen' }
  ]);
});

router.get('/admin/reports/top-books', function (req, res) {
  try {
    const rows = reports.topBooks(req.query);
    if (!wantsCsv(req)) return res.json(rows);
    csv.send(res, filename('top-buecher'), rows, [
      { key: 'isbn', label: 'ISBN' },
      { key: 'title', label: 'Titel' },
      { key: 'author', label: 'Autor' },
      { key: 'loans', label: 'Ausleihen' },
      { key: 'readers', label: 'Personen' },
      { key: 'waiting', label: 'wartend' }
    ]);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/admin/reports/waitlists', function (req, res) {
  const rows = reports.waitlists();
  if (!wantsCsv(req)) return res.json(rows);
  csv.send(res, filename('wartelisten'), rows, [
    { key: 'isbn', label: 'ISBN' },
    { key: 'title', label: 'Titel' },
    { key: 'waiting', label: 'wartend' },
    { key: 'ready', label: 'im Abholregal' },
    { key: 'copies', label: 'Exemplare' },
    { key: 'waiting_since', label: 'wartet seit' }
  ]);
});

router.get('/admin/reports/revenue', function (req, res) {
  try {
    const data = reports.revenuePerMonth(req.query);
    if (!wantsCsv(req)) return res.json(data);
    csv.send(res, filename('umsatz'), data.rows, [
      { key: 'month', label: 'Monat' },
      { key: 'orders', label: 'Bestellungen' },
      { key: 'items', label: 'Bücher' },
      { key: 'net', label: 'netto' },
      { key: 'vat', label: 'MwSt' },
      { key: 'gross', label: 'brutto' }
    ]);
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
