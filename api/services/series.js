// Serien (book series) for the admin. A series is a chain of books linked by
// predecessor_isbn / successor_isbn. The admin page shows all chains and can set the order.
const db = require('../db');
const isbnLib = require('../lib/isbn');
const bookService = require('./books');

const MAX_VOLUMES = 50;

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// links typed in by hand sometimes have no hyphens, so compare digits only
function findLinked(isbn) {
  if (!isbn) return null;
  return db.open()
    .prepare("SELECT * FROM books WHERE replace(isbn, '-', '') = ?")
    .get(isbnLib.normalizeIsbn(isbn)) || null;
}

function volume(row) {
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    subtitle: row.subtitle,
    author: row.author,
    predecessorIsbn: row.predecessor_isbn,
    successorIsbn: row.successor_isbn,
    cover: '/covers/' + row.isbn.replace(/-/g, '') + '.png'
  };
}

function chainFrom(start) {
  const books = [];
  const seen = {};
  let current = start;
  while (current && !seen[current.id] && books.length < MAX_VOLUMES) {
    seen[current.id] = true;
    books.push(volume(current));
    current = findLinked(current.successor_isbn);
  }
  return books;
}

// all series: [{ name, author, volumes: [...] }]
function all() {
  const rows = db.open()
    .prepare('SELECT * FROM books WHERE predecessor_isbn IS NOT NULL OR successor_isbn IS NOT NULL ORDER BY title')
    .all();
  const inChain = {};
  const out = [];
  rows.forEach(function (row) {
    if (inChain[row.id]) return;
    // first volume: no predecessor, or the predecessor is not in the catalogue
    if (row.predecessor_isbn && findLinked(row.predecessor_isbn)) return;
    const volumes = chainFrom(row);
    volumes.forEach(v => { inChain[v.id] = true; });
    out.push({ name: seriesName(volumes), author: volumes[0].author, volumes: volumes });
  });
  // books in a loop (A -> B -> A) have no first volume, show them anyway
  rows.forEach(function (row) {
    if (inChain[row.id]) return;
    const volumes = chainFrom(row);
    volumes.forEach(v => { inChain[v.id] = true; });
    out.push({ name: seriesName(volumes), author: volumes[0].author, volumes: volumes, loop: true });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const STOP = /^(and|the|of|a|und|der|die|das|part|band|book|vol\.?)$/i;

function commonPrefix(texts) {
  if (texts.some(t => !t)) return '';
  const words = texts.map(t => t.split(/\s+/));
  const common = [];
  for (let i = 0; i < words[0].length; i++) {
    const w = words[0][i];
    if (!words.every(list => list[i] === w)) break;
    common.push(w);
  }
  while (common.length && STOP.test(common[common.length - 1].replace(/[,:;]$/, ''))) common.pop();
  return common.join(' ').replace(/[,:;\s]+$/, '');
}

// "Harry Potter and the ..." -> "Harry Potter", subtitles "The Lord of the Rings, Part One" -> "The Lord of the Rings"
function seriesName(volumes) {
  if (volumes.length < 2) return volumes[0].title;
  const fromTitles = commonPrefix(volumes.map(v => v.title));
  const fromSubtitles = commonPrefix(volumes.map(v => v.subtitle));
  const best = fromSubtitles.length > fromTitles.length ? fromSubtitles : fromTitles;
  if (!best || best.split(' ').every(w => STOP.test(w))) return volumes[0].title + ' ...';
  return best;
}

// isbns in reading order -> sets predecessor / successor on every volume
function save(isbns) {
  if (!Array.isArray(isbns) || isbns.length < 2) throw fail(400, 'a series needs at least 2 books');
  if (isbns.length > MAX_VOLUMES) throw fail(400, 'too many books');
  const rows = isbns.map(function (isbn) {
    const row = findLinked(isbn);
    if (!row) throw fail(404, 'book not found: ' + isbn);
    return row;
  });
  const ids = rows.map(r => r.id);
  if (ids.some((id, idx) => ids.indexOf(id) !== idx)) throw fail(400, 'a book is in the list twice');

  const conn = db.open();
  conn.exec('BEGIN');
  try {
    rows.forEach(function (row, idx) {
      bookService.update(row, {
        predecessorIsbn: idx > 0 ? rows[idx - 1].isbn : null,
        successorIsbn: idx < rows.length - 1 ? rows[idx + 1].isbn : null
      });
    });
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
  return chainFrom(bookService.findById(rows[0].id));
}

// takes one book out of its series and closes the gap
function remove(isbn) {
  const row = findLinked(isbn);
  if (!row) throw fail(404, 'book not found');
  const prev = findLinked(row.predecessor_isbn);
  const next = findLinked(row.successor_isbn);
  if (prev) bookService.update(prev, { successorIsbn: next ? next.isbn : null });
  if (next) bookService.update(next, { predecessorIsbn: prev ? prev.isbn : null });
  bookService.update(bookService.findById(row.id), { predecessorIsbn: null, successorIsbn: null });
  return { removed: row.isbn };
}

module.exports = { all, save, remove, seriesName, findLinked };
