// Saving books (admin). Reading is still in routes.js (v1) and src/v2/repo.ts (v2).
const db = require('../db');
const utils = require('../lib/utils');
const money = require('../lib/money');
const isbnLib = require('../lib/isbn');

// all writable columns of books
const COLUMNS = [
  'isbn',
  'title',
  'subtitle',
  'author',
  'co_authors',
  'publisher',
  'abstract',
  'num_pages',
  'published_at',
  'price',
  'currency',
  'predecessor_isbn',
  'successor_isbn',
  'updated_at'
];

function findById(id) {
  return db.open().prepare('SELECT * FROM books WHERE id = ?').get(id);
}

function linkValue(value) {
  return value ? isbnLib.format(value) : null;
}

// request body (form values, mostly strings) -> values for the row
function clean(body) {
  const out = Object.assign({}, body);
  Object.keys(out).forEach(function (key) {
    if (out[key] === '') out[key] = null;
    if (typeof out[key] === 'string') out[key] = out[key].trim();
  });
  if (out.coAuthors !== undefined) {
    const list = Array.isArray(out.coAuthors) ? out.coAuthors : String(out.coAuthors || '').split(',');
    out.co_authors = JSON.stringify(list.map(s => String(s).trim()).filter(Boolean));
    delete out.coAuthors;
  }
  if (out.predecessorIsbn !== undefined) {
    out.predecessor_isbn = linkValue(out.predecessorIsbn);
    delete out.predecessorIsbn;
  }
  if (out.successorIsbn !== undefined) {
    out.successor_isbn = linkValue(out.successorIsbn);
    delete out.successorIsbn;
  }
  if (out.price !== undefined && out.price !== null) out.price = money.round(money.parse(out.price));
  if (out.numPages !== undefined && out.numPages !== null) out.numPages = parseInt(out.numPages, 10);
  return out;
}

// row = current db row, body = changes from the admin form. Returns the saved row.
function update(row, body) {
  const next = Object.assign(row, clean(body));
  next.isbn = isbnLib.normalizeIsbn(next.isbn);
  next.updated_at = utils.now();
  db.open()
    .prepare('UPDATE books SET ' + COLUMNS.map(c => c + ' = ?').join(', ') + ' WHERE id = ?')
    .run(...COLUMNS.map(c => (next[c] === undefined ? null : next[c])), next.id);
  return findById(next.id);
}

module.exports = { COLUMNS, update, findById, clean };
