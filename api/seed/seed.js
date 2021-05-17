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

function run(db) {
  const n = importBooks(db, readBooks());
  const u = importUsers(db, USERS);
  if (process.env.NODE_ENV !== 'test') console.log('[seed] ' + n + ' books, ' + u + ' users');
}

module.exports = { run, importBooks, importUsers, readBooks, USERS };
