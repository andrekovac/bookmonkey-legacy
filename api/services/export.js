// Admin exports (2024). The library leads want the catalogue with prices in Excel
// for the yearly budget meeting.
const db = require('../db');
const pricing = require('../lib/pricing');
const utils = require('../lib/utils');
const reservations = require('./reservations');
const auth = require('../lib/auth');

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

// Rezensionen (2025, export v2): the library leads read them once a quarter in Excel.
// opts: { isbn, minRating, maxRating }
function reviews(opts) {
  opts = opts || {};
  const where = [];
  const params = [];
  if (opts.isbn) {
    where.push('b.isbn = ?');
    params.push(opts.isbn);
  }
  if (opts.minRating) {
    where.push('r.rating >= ?');
    params.push(opts.minRating);
  }
  if (opts.maxRating) {
    where.push('r.rating <= ?');
    params.push(opts.maxRating);
  }
  let sql = `SELECT r.id, r.rating, r.text, r.created_at, r.updated_at, b.isbn, b.title, b.author,
      u.name AS user_name, u.email, u.location, u.department
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    JOIN users u ON u.id = r.user_id`;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY r.created_at DESC';
  return db.open().prepare(sql).all(...params).map(function (r) {
    return {
      created_at: shortStamp(r.created_at),
      isbn: r.isbn,
      title: r.title,
      author: r.author,
      rating: r.rating,
      user_name: r.user_name,
      email: r.email,
      location: r.location || '',
      department: r.department || '',
      text: r.text || ''
    };
  });
}

const REVIEW_COLUMNS = [
  { key: 'created_at', label: 'Datum' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'title', label: 'Titel' },
  { key: 'author', label: 'Autor' },
  { key: 'rating', label: 'Sterne' },
  { key: 'user_name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { key: 'location', label: 'Standort' },
  { key: 'department', label: 'Abteilung' },
  { key: 'text', label: 'Text' }
];

// Ausleihen (2025, export v2), for the yearly report to the works council.
// opts: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', location, open }
function loans(opts) {
  opts = opts || {};
  const where = [];
  const params = [];
  if (opts.from) {
    where.push('l.borrowed_at >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    where.push('l.borrowed_at < ?');
    params.push(utils.addDays(1, opts.to));
  }
  if (opts.location) {
    where.push('c.location = ?');
    params.push(opts.location);
  }
  if (opts.open) where.push('l.returned_at IS NULL');
  let sql = `SELECT l.*, c.barcode, c.location, b.isbn, b.title
    FROM loans l
    JOIN copies c ON c.id = l.copy_id
    JOIN books b ON b.id = c.book_id`;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY l.borrowed_at';

  return db.open().prepare(sql).all(...params).map(function (l) {
    const user = auth.findUser(l.user_id) || {};
    return {
      id: l.id,
      borrowed_at: shortStamp(l.borrowed_at),
      due_at: l.due_at,
      returned_at: shortStamp(l.returned_at),
      renewals: l.renewals,
      reminders: l.reminder_count,
      barcode: l.barcode,
      location: l.location,
      isbn: l.isbn,
      title: l.title,
      user_name: user.name || '',
      email: user.email || '',
      department: user.department || ''
    };
  });
}

const LOAN_COLUMNS = [
  { key: 'id', label: 'Nr.' },
  { key: 'borrowed_at', label: 'ausgeliehen' },
  { key: 'due_at', label: 'fällig' },
  { key: 'returned_at', label: 'zurück' },
  { key: 'renewals', label: 'Verlängerungen' },
  { key: 'reminders', label: 'Erinnerungen' },
  { key: 'barcode', label: 'Exemplar' },
  { key: 'location', label: 'Standort' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'title', label: 'Titel' },
  { key: 'user_name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { key: 'department', label: 'Abteilung' }
];

function filename(name) {
  return 'bookmonkey-' + name + '-' + utils.today() + '.csv';
}

module.exports = {
  books,
  BOOK_COLUMNS,
  booksFilename,
  waitlist,
  WAITLIST_COLUMNS,
  waitlistFilename,
  reviews,
  REVIEW_COLUMNS,
  loans,
  LOAN_COLUMNS,
  filename
};
