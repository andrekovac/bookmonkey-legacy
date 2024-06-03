// Admin exports (2024). The library leads want the catalogue with prices in Excel
// for the yearly budget meeting.
const db = require('../db');
const pricing = require('../lib/pricing');
const utils = require('../lib/utils');

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

module.exports = { books, BOOK_COLUMNS, booksFilename };
