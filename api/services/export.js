// Admin exports (2024). The library leads want the catalogue with prices in Excel
// for the yearly budget meeting.
const db = require('../db');
const pricing = require('../lib/pricing');
const utils = require('../lib/utils');
const reservations = require('./reservations');

// opts: { publisher, onlyWithCopies }
function books(opts) {
  opts = opts || {};
  let sql = `SELECT b.*,
      (SELECT COUNT(*) FROM copies c WHERE c.book_id = b.id AND c.status <> 'lost') AS copies,
      (SELECT COUNT(*) FROM loans l JOIN copies c ON c.id = l.copy_id WHERE c.book_id = b.id) AS loans
    FROM books b`;
  const where = [];
  const params = [];
  if (opts.publisher) {
    where.push('b.publisher = ?');
    params.push(opts.publisher);
  }
  if (opts.onlyWithCopies) {
    where.push("EXISTS (SELECT 1 FROM copies c WHERE c.book_id = b.id AND c.status <> 'lost')");
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY b.title';

  const rules = pricing.activeRules();
  return db.open().prepare(sql).all(...params).map(function (row) {
    const rule = pricing.bestRule(row, rules);
    const discount = rule ? rule.percent / 100 : 0;
    // Neuanschaffungen without a price yet (acquisition form allows an empty price)
    const hasPrice = row.price !== null && row.price !== undefined;
    return {
      isbn: row.isbn,
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      published_at: row.published_at,
      num_pages: row.num_pages,
      price_net: hasPrice ? row.price.toFixed(2) : '',
      discount: discount ? Math.round(discount * 100) + ' %' : '',
      discount_name: rule ? rule.name : '',
      // Brutto, so wie es im Katalog steht
      price_gross: hasPrice ? row.price * (1 - discount) * (1 + pricing.VAT_BOOKS) : '',
      currency: row.currency,
      copies: row.copies,
      loans: row.loans
    };
  });
}

const BOOK_COLUMNS = [
  { key: 'isbn', label: 'ISBN' },
  { key: 'title', label: 'Titel' },
  { key: 'author', label: 'Autor' },
  { key: 'publisher', label: 'Verlag' },
  { key: 'published_at', label: 'erschienen' },
  { key: 'num_pages', label: 'Seiten' },
  { key: 'price_net', label: 'Preis netto' },
  { key: 'discount', label: 'Rabatt' },
  { key: 'discount_name', label: 'Rabattaktion' },
  { key: 'price_gross', label: 'Preis brutto' },
  { key: 'currency', label: 'Währung' },
  { key: 'copies', label: 'Exemplare' },
  { key: 'loans', label: 'Ausleihen gesamt' }
];

function booksFilename() {
  return 'bookmonkey-buecher-' + utils.today() + '.csv';
}

// Warteliste (2025): the library team plans new copies with it ("more than 3 waiting -> buy one").
// opts: { status (default waiting), bookId }
function waitlist(opts) {
  opts = opts || {};
  const users = {};
  db.open().prepare('SELECT id, location, department FROM users').all().forEach(function (u) {
    users[u.id] = u;
  });
  return reservations.list({ status: opts.status || 'waiting', bookId: opts.bookId }).map(function (r) {
    const user = users[r.user_id] || {};
    return {
      title: r.title,
      isbn: r.isbn,
      position: r.position || '',
      user_name: r.user_name,
      email: r.email,
      location: r.location || user.location || '',
      department: user.department || '',
      created_at: shortStamp(r.created_at),
      source: r.source,
      status: r.status,
      expires_at: shortStamp(r.expires_at)
    };
  });
}

// "2024-03-01 09:12:44" and "2024-03-01T08:12:44.000Z" -> "2024-03-01 09:12"
function shortStamp(value) {
  if (!value) return '';
  return String(value).replace('T', ' ').slice(0, 16);
}

const WAITLIST_COLUMNS = [
  { key: 'title', label: 'Titel' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'position', label: 'Platz' },
  { key: 'user_name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { key: 'location', label: 'Standort' },
  { key: 'department', label: 'Abteilung' },
  { key: 'created_at', label: 'vorgemerkt am' },
  { key: 'source', label: 'über' },
  { key: 'status', label: 'Status' },
  { key: 'expires_at', label: 'Abholfrist' }
];

function waitlistFilename(status) {
  return 'bookmonkey-warteliste-' + (status || 'waiting') + '-' + utils.today() + '.csv';
}

module.exports = { books, BOOK_COLUMNS, booksFilename, waitlist, WAITLIST_COLUMNS, waitlistFilename };
