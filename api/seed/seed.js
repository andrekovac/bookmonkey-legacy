// Imports the catalogue from books.json into the database.
// books.json comes from the old shop export (camelCase, plain ISBNs).
const path = require('path');
const fs = require('fs');
const isbn = require('../lib/isbn');
const utils = require('../lib/utils');
const auth = require('../lib/auth');

function readBooks() {
  const file = path.join(__dirname, 'books.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function importBooks(db, books) {
  const insert = db.prepare(`INSERT INTO books
    (isbn, title, subtitle, author, co_authors, publisher, abstract, num_pages,
     published_at, price, currency, predecessor_isbn, successor_isbn, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let count = 0;
  books.forEach(function (b) {
    const ts = utils.now();
    insert.run(
      isbn.format(b.isbn),
      b.title,
      b.subtitle || null,
      b.author || null,
      JSON.stringify(b.coAuthors || []),
      b.publisher || null,
      b.abstract || null,
      b.numPages || null,
      b.publishedAt || null,
      b.price,
      b.currency || 'EUR',
      b.predecessorIsbn ? isbn.format(b.predecessorIsbn) : null,
      b.successorIsbn ? isbn.format(b.successorIsbn) : null,
      ts,
      ts
    );
    count++;
  });
  return count;
}

// shop staff + a few test customers
const USERS = [
  { email: 'admin@bookmonkey.example', password: 'admin2021', name: 'Shop Admin', role: 'admin' },
  { email: 'mia.schulz@example.com', password: 'lesen123', name: 'Mia Schulz', role: 'customer' },
  { email: 'jonas.becker@example.com', password: 'jonas2021', name: 'Jonas Becker', role: 'customer' },
  { email: 'lea.hoffmann@example.com', password: 'buecher', name: 'Lea Hoffmann', role: 'customer' }
];

function importUsers(db, users) {
  const insert = db.prepare('INSERT INTO users (email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)');
  users.forEach(function (u) {
    insert.run(u.email, auth.hashPassword(u.password), u.name, u.role, utils.now());
  });
  return users.length;
}

// Exemplare for the company libraries (2022). Every book has at least one copy in Hamburg,
// every third book a second one in Berlin. The books below are asked for a lot.
const EXTRA_COPIES = {
  '9780735211292': ['Berlin'], // Atomic Habits
  '9781455586691': ['Hamburg', 'München'], // Deep Work
  '9780374533557': ['München'], // Thinking, Fast and Slow
  '9780747532699': ['München'] // Harry Potter 1
};

function importCopies(db) {
  const books = db.prepare('SELECT id, isbn FROM books ORDER BY id').all();
  const insert = db.prepare('INSERT INTO copies (book_id, barcode, location, shelf, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let n = 0;
  books.forEach(function (b, idx) {
    const locations = ['Hamburg'];
    if (idx % 3 === 0) locations.push('Berlin');
    (EXTRA_COPIES[isbn.digitsOnly(b.isbn)] || []).forEach(l => locations.push(l));
    locations.forEach(function (loc) {
      n++;
      const ts = utils.now();
      insert.run(b.id, utils.barcode(n), loc, 'R' + (1 + (idx % 6)), 'available', ts, ts);
    });
  });
  return n;
}

// Rabattaktionen. The Sommer one is over, stays in the list as an example.
const DISCOUNT_RULES = [
  { name: 'Fantasy-Wochen Tor', scope: 'publisher', value: 'Tor Books', percent: 10 },
  { name: 'Kinderbuch-Aktion', scope: 'publisher', value: 'HarperCollins', percent: 15 },
  { name: 'Sommer 2022', scope: 'all', value: null, percent: 5, valid_from: '2022-07-01', valid_until: '2022-08-31' }
];

function importDiscounts(db, rules) {
  const insert = db.prepare(`INSERT INTO discount_rules (name, scope, value, percent, active, valid_from, valid_until, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`);
  rules.forEach(function (r) {
    insert.run(r.name, r.scope, r.value, r.percent, r.valid_from || null, r.valid_until || null, utils.now(), utils.now());
  });
  return rules.length;
}

function run(db) {
  const n = importBooks(db, readBooks());
  const u = importUsers(db, USERS);
  const c = importCopies(db);
  importDiscounts(db, DISCOUNT_RULES);
  if (process.env.NODE_ENV !== 'test') console.log('[seed] ' + n + ' books, ' + u + ' users, ' + c + ' copies');
}

module.exports = { run, importBooks, importUsers, importCopies, importDiscounts, readBooks, USERS, DISCOUNT_RULES };
