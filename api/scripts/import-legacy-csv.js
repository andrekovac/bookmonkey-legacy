// Imports / updates books from the supplier price list (CSV export from the
// old shop system, semicolon separated, german number and date format).
//
// usage:
//   node --disable-warning=ExperimentalWarning scripts/import-legacy-csv.js <file.csv> [--dry-run]
//
// columns: ISBN;Titel;Autor;Verlag;Seiten;Erscheinungsdatum;Preis;Vorgaenger;Nachfolger;Beschreibung
// existing books (same ISBN) are updated, new ones are inserted.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const isbn = require('../lib/isbn');
const money = require('../lib/money');
const utils = require('../lib/utils');

const COLUMNS = ['isbn', 'title', 'author', 'publisher', 'num_pages', 'published_at', 'price',
  'predecessor_isbn', 'successor_isbn', 'abstract'];

// minimal csv parser, handles "quoted;fields" and "" escapes
function parseLine(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(v => v.trim());
}

// 26.06.1997 -> 1997-06-26
function germanDate(value) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value || '');
  if (!m) return value || null;
  return m[3] + '-' + utils.pad(parseInt(m[2], 10)) + '-' + utils.pad(parseInt(m[1], 10));
}

function toRecord(cells) {
  const rec = {};
  COLUMNS.forEach(function (col, idx) {
    rec[col] = cells[idx] === undefined || cells[idx] === '' ? null : cells[idx];
  });
  rec.isbn = isbn.format(rec.isbn);
  rec.predecessor_isbn = rec.predecessor_isbn ? isbn.format(rec.predecessor_isbn) : null;
  rec.successor_isbn = rec.successor_isbn ? isbn.format(rec.successor_isbn) : null;
  rec.num_pages = rec.num_pages ? parseInt(rec.num_pages, 10) : null;
  rec.price = rec.price ? money.round(money.parse(rec.price)) : null;
  rec.published_at = germanDate(rec.published_at);
  return rec;
}

function run(file, options) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const header = lines.shift();
  if (!header || header.toLowerCase().indexOf('isbn') !== 0) {
    throw new Error('first line must be the header (ISBN;Titel;...)');
  }

  const conn = db.open();
  const find = conn.prepare('SELECT id FROM books WHERE isbn = ?');
  const insert = conn.prepare(`INSERT INTO books (isbn, title, author, publisher, num_pages, published_at, price,
    predecessor_isbn, successor_isbn, abstract, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?)`);
  const update = conn.prepare(`UPDATE books SET title = ?, author = ?, publisher = ?, num_pages = ?, published_at = ?,
    price = ?, predecessor_isbn = ?, successor_isbn = ?, abstract = COALESCE(?, abstract), updated_at = ? WHERE id = ?`);

  const stats = { inserted: 0, updated: 0, skipped: 0 };
  lines.forEach(function (line, idx) {
    const rec = toRecord(parseLine(line, ';'));
    if (!isbn.isValid(rec.isbn) || !rec.title) {
      console.warn('line ' + (idx + 2) + ': skipped (isbn or title missing/invalid): ' + line.slice(0, 60));
      stats.skipped++;
      return;
    }
    const existing = find.get(rec.isbn);
    if (options.dryRun) {
      console.log((existing ? 'update ' : 'insert ') + rec.isbn + ' ' + rec.title);
      stats[existing ? 'updated' : 'inserted']++;
      return;
    }
    const ts = utils.now();
    if (existing) {
      update.run(rec.title, rec.author, rec.publisher, rec.num_pages, rec.published_at, rec.price,
        rec.predecessor_isbn, rec.successor_isbn, rec.abstract, ts, existing.id);
      stats.updated++;
    } else {
      insert.run(rec.isbn, rec.title, rec.author, rec.publisher, rec.num_pages, rec.published_at, rec.price,
        rec.predecessor_isbn, rec.successor_isbn, rec.abstract, ts, ts);
      stats.inserted++;
    }
  });
  return stats;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.filter(a => a.indexOf('--') !== 0)[0];
  if (!file) {
    console.log('usage: node scripts/import-legacy-csv.js <file.csv> [--dry-run]');
    process.exit(1);
  }
  const stats = run(path.resolve(file), { dryRun: args.indexOf('--dry-run') !== -1 });
  console.log('done: ' + stats.inserted + ' new, ' + stats.updated + ' updated, ' + stats.skipped + ' skipped');
  db.close();
}

module.exports = { run, parseLine, toRecord, germanDate };
