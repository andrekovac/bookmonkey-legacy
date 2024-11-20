// Datenkorrekturen 2024 (gemeldet vom Bibliotheksteam).
// Runs after the seed in `npm run db:reset`, and was run once on the live database:
//   node --disable-warning=ExperimentalWarning seed/fixes-2024.js
// Every fix goes through services/books.update(), same as saving in the admin,
// so updated_at is set and nothing is written around the normal checks.
// Safe to run twice: a fix is skipped when the book does not look like `when` any more.
const db = require('../db');
const bookService = require('../services/books');

const FIXES = [
  {
    isbn: '978-0-547-92820-3',
    why: 'Tippfehler im Titel (Ticket "Herr der Ringe Band 2 falsch geschrieben")',
    when: { title: 'The Two Towres' },
    changes: { title: 'The Two Towers' }
  },
  {
    isbn: '978-0-06-112241-5',
    why: 'Untertitel fehlte, Erscheinungsdatum war ein Platzhalter aus dem Shop-Export',
    when: { published_at: '1988-01-01' },
    changes: { subtitle: 'A Fable About Following Your Dream', publishedAt: '1993-05-01' }
  }
];

function matches(row, when) {
  return Object.keys(when || {}).every(key => row[key] === when[key]);
}

function run(conn) {
  conn = conn || db.open();
  let applied = 0;
  FIXES.forEach(function (fix) {
    const row = conn.prepare('SELECT * FROM books WHERE isbn = ?').get(fix.isbn);
    if (!row || !matches(row, fix.when)) return;
    bookService.update(row, fix.changes);
    applied++;
  });
  if (process.env.NODE_ENV !== 'test') {
    console.log('[fixes-2024] ' + applied + ' of ' + FIXES.length + ' applied');
  }
  return applied;
}

if (require.main === module) {
  run(db.open());
  db.close();
}

module.exports = { run, FIXES };
