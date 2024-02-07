// Merkliste (2024). A personal list of books, with the current availability so the list
// can say "jetzt ausleihbar". From the list a book can be turned into a reservation.
const db = require('../db');
const utils = require('../lib/utils');
const reservations = require('./reservations');
const waitlist = require('./waitlist');

const MAX_ITEMS = 100;
const NOTE_MAX = 200;

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const SELECT = `SELECT w.id, w.note, w.created_at, b.id AS book_id, b.isbn, b.title, b.author, b.publisher,
    (SELECT COUNT(*) FROM copies c WHERE c.book_id = b.id AND c.status <> 'lost') AS copies,
    (SELECT COUNT(*) FROM copies c WHERE c.book_id = b.id AND c.status = 'available') AS available
  FROM wishlist w JOIN books b ON b.id = w.book_id`;

function item(row, userId) {
  if (!row) return null;
  const mine = reservations.openFor(userId, row.book_id);
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    note: row.note,
    addedAt: row.created_at,
    copies: row.copies,
    available: row.available,
    // what the list can offer: borrow, reserve, nothing (shop only) or "already reserved"
    action: mine ? 'reserved' : row.copies === 0 ? 'none' : row.available > 0 ? 'borrow' : 'reserve',
    reservation: mine ? { id: mine.id, status: mine.status, position: waitlist.position(mine) } : null,
    cover: '/covers/' + row.isbn.replace(/-/g, '') + '.png'
  };
}

function listFor(userId) {
  return db.open()
    .prepare(SELECT + ' WHERE w.user_id = ? ORDER BY w.created_at DESC, w.id DESC')
    .all(userId)
    .map(r => item(r, userId));
}

function find(userId, bookId) {
  return db.open().prepare(SELECT + ' WHERE w.user_id = ? AND w.book_id = ?').get(userId, bookId);
}

function contains(userId, bookId) {
  return !!find(userId, bookId);
}

function add(userId, book, note) {
  const conn = db.open();
  if (find(userId, book.id)) throw fail(409, 'book is on your list already');
  const count = conn.prepare('SELECT COUNT(*) AS n FROM wishlist WHERE user_id = ?').get(userId).n;
  if (count >= MAX_ITEMS) throw fail(409, 'your list is full (max ' + MAX_ITEMS + ')');
  const text = note ? String(note).trim().slice(0, NOTE_MAX) : null;
  conn.prepare('INSERT INTO wishlist (user_id, book_id, note, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, book.id, text || null, utils.now());
  return item(find(userId, book.id), userId);
}

function setNote(userId, book, note) {
  const row = find(userId, book.id);
  if (!row) throw fail(404, 'book is not on your list');
  const text = note ? String(note).trim().slice(0, NOTE_MAX) : null;
  db.open().prepare('UPDATE wishlist SET note = ? WHERE id = ?').run(text || null, row.id);
  return item(find(userId, book.id), userId);
}

function remove(userId, bookId) {
  return db.open().prepare('DELETE FROM wishlist WHERE user_id = ? AND book_id = ?').run(userId, bookId).changes > 0;
}

// "Vormerken" from the list: creates the reservation and takes the book off the list.
// reservations.create() throws 409 when a copy is on the shelf, the web then offers to borrow it.
function toReservation(userId, book, opts) {
  opts = opts || {};
  if (!find(userId, book.id)) throw fail(404, 'book is not on your list');
  const reservation = reservations.create(userId, book, { location: opts.location, via: 'wishlist' });
  remove(userId, book.id);
  return reservation;
}

module.exports = { listFor, contains, add, setNote, remove, toReservation, MAX_ITEMS };
