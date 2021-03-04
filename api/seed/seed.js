// Imports the catalogue from books.json into the database.
// books.json comes from the old shop export (camelCase, plain ISBNs).
const path = require('path');
const fs = require('fs');
const isbn = require('../lib/isbn');
const utils = require('../lib/utils');

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

function run(db) {
  const n = importBooks(db, readBooks());
  if (process.env.NODE_ENV !== 'test') console.log('[seed] ' + n + ' books');
}

module.exports = { run, importBooks, readBooks };
