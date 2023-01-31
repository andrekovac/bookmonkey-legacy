// One-off import of the old inventory list of the libraries (Excel, saved as CSV with ;).
// Creates copies for books that are in the catalogue already.
//
// usage:
//   node --disable-warning=ExperimentalWarning scripts/import-copies-csv.js <file.csv> [--dry-run]
//
// columns: Barcode;ISBN;Standort;Regal;Notiz
// - Barcode empty -> a new BM-xxxxx is created (print the label!)
// - ISBN not in the catalogue -> skipped, add the book first (Neuanschaffung or import-legacy-csv)
const fs = require('fs');
const path = require('path');
const db = require('../db');
const isbn = require('../lib/isbn');
const utils = require('../lib/utils');
const validate = require('../lib/validate');
const { parseLine } = require('./import-legacy-csv');

const LOCATIONS = ['Hamburg', 'Berlin', 'München'];

// the Excel list has "HH", "BER", "MUC" in some rows
const LOCATION_ALIASES = {
  hh: 'Hamburg',
  hamburg: 'Hamburg',
  ber: 'Berlin',
  berlin: 'Berlin',
  muc: 'München',
  muenchen: 'München',
  'münchen': 'München'
};

function toRecord(cells) {
  return {
    barcode: cells[0] ? cells[0].toUpperCase() : null,
    isbn: cells[1] ? isbn.format(cells[1]) : null,
    location: LOCATION_ALIASES[String(cells[2] || '').toLowerCase()] || cells[2] || null,
    shelf: cells[3] || null,
    note: cells[4] || null
  };
}

function run(file, options) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const header = lines.shift();
  if (!header || header.toLowerCase().indexOf('barcode') !== 0) {
    throw new Error('first line must be the header (Barcode;ISBN;Standort;Regal;Notiz)');
  }

  const conn = db.open();
  const findBook = conn.prepare('SELECT id, title FROM books WHERE isbn = ?');
  const findCopy = conn.prepare('SELECT id FROM copies WHERE barcode = ?');
  const insert = conn.prepare(`INSERT INTO copies (book_id, barcode, location, shelf, status, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'available', ?, ?, ?)`);
  const maxId = conn.prepare('SELECT MAX(id) AS max FROM copies');

  const stats = { inserted: 0, skipped: 0, labels: [] };
  lines.forEach(function (line, idx) {
    const rec = toRecord(parseLine(line, ';'));
    const errors = validate.isbn(rec.isbn);
    if (LOCATIONS.indexOf(rec.location) === -1) errors.push('unknown location ' + rec.location);
    const book = errors.length ? null : findBook.get(rec.isbn);
    if (!errors.length && !book) errors.push('book ' + rec.isbn + ' not in catalogue');
    if (rec.barcode && findCopy.get(rec.barcode)) errors.push('barcode ' + rec.barcode + ' exists');
    if (errors.length) {
      console.warn('line ' + (idx + 2) + ': skipped (' + errors.join(', ') + ')');
      stats.skipped++;
      return;
    }

    let code = rec.barcode;
    if (!code) {
      code = utils.barcode((maxId.get().max || 0) + 1 + (options.dryRun ? stats.inserted : 0));
      stats.labels.push(code + ' ' + book.title);
    }
    if (options.dryRun) {
      console.log('insert ' + code + ' ' + rec.isbn + ' ' + rec.location + ' ' + (rec.shelf || ''));
    } else {
      insert.run(book.id, code, rec.location, rec.shelf, rec.note, utils.now(), utils.now());
    }
    stats.inserted++;
  });
  return stats;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.filter(a => a.indexOf('--') !== 0)[0];
  if (!file) {
    console.log('usage: node scripts/import-copies-csv.js <file.csv> [--dry-run]');
    process.exit(1);
  }
  const stats = run(path.resolve(file), { dryRun: args.indexOf('--dry-run') !== -1 });
  console.log('done: ' + stats.inserted + ' copies, ' + stats.skipped + ' skipped');
  if (stats.labels.length) {
    console.log('new labels to print:');
    stats.labels.forEach(l => console.log('  ' + l));
  }
  db.close();
}

module.exports = { run, toRecord };
