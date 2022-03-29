// Vormerkungen. A reservation is only possible when no copy is on the shelf.
const db = require('../db');
const utils = require('../lib/utils');
const waitlist = require('./waitlist');

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function withPosition(r) {
  if (!r) return r;
  r.position = waitlist.position(r);
  r.cover = '/covers/' + r.isbn.replace(/-/g, '') + '.png';
  return r;
}

function openFor(userId, bookId) {
  return db.open()
    .prepare("SELECT * FROM reservations WHERE user_id = ? AND book_id = ? AND status IN ('waiting', 'ready')")
    .get(userId, bookId);
}

function create(userId, book, opts) {
  opts = opts || {};
  const conn = db.open();

  if (openFor(userId, book.id)) throw fail(409, 'you have reserved this book already');

  const loan = conn.prepare(`SELECT l.id FROM loans l JOIN copies c ON c.id = l.copy_id
    WHERE l.user_id = ? AND c.book_id = ? AND l.returned_at IS NULL`).get(userId, book.id);
  if (loan) throw fail(409, 'you have borrowed this book already');

  const copies = conn.prepare("SELECT COUNT(*) AS n FROM copies WHERE book_id = ? AND status <> 'lost'").get(book.id).n;
  if (!copies) throw fail(409, 'the library has no copy of this book');

  const available = conn.prepare("SELECT COUNT(*) AS n FROM copies WHERE book_id = ? AND status = 'available'").get(book.id).n;
  if (available > 0) throw fail(409, 'a copy is available, you can borrow it right away');

  const r = conn.prepare("INSERT INTO reservations (book_id, user_id, status, location, created_at) VALUES (?, ?, 'waiting', ?, ?)")
    .run(book.id, userId, opts.location || null, utils.now());
  return withPosition(waitlist.findReservation(Number(r.lastInsertRowid)));
}

function listFor(userId, all) {
  let sql = waitlist.RES_SELECT + ' WHERE r.user_id = ?';
  if (!all) sql += " AND r.status IN ('waiting', 'ready')";
  sql += ' ORDER BY r.created_at DESC';
  return db.open().prepare(sql).all(userId).map(withPosition);
}

function cancel(id, userId, isAdmin) {
  const r = waitlist.findReservation(id);
  if (!r || (r.user_id !== userId && !isAdmin)) throw fail(404, 'reservation not found');
  if (r.status !== 'waiting' && r.status !== 'ready') throw fail(409, 'reservation is ' + r.status);

  const conn = db.open();
  conn.prepare("UPDATE reservations SET status = 'cancelled', closed_at = ? WHERE id = ?").run(utils.now(), r.id);
  // copy was waiting on the hold shelf -> next person
  if (r.status === 'ready' && r.copy_id) {
    const copy = conn.prepare('SELECT * FROM copies WHERE id = ?').get(r.copy_id);
    if (copy && copy.status === 'on_hold') waitlist.copyReturned(copy);
  }
  return withPosition(waitlist.findReservation(r.id));
}

// admin list
function list(opts) {
  opts = opts || {};
  let sql = waitlist.RES_SELECT;
  const where = [];
  const params = [];
  if (opts.status) {
    where.push('r.status = ?');
    params.push(opts.status);
  }
  if (opts.bookId) {
    where.push('r.book_id = ?');
    params.push(opts.bookId);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY r.book_id, r.created_at LIMIT 500';
  return db.open().prepare(sql).all(...params).map(withPosition);
}

module.exports = { fail, create, cancel, listFor, list, openFor, withPosition };
