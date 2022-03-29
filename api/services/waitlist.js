// Warteliste: who gets a copy when it comes back.
// First come, first served. The first waiting person gets the copy on the hold shelf
// and has HOLD_HOURS to pick it up, after that it goes to the next one.
const db = require('../db');
const utils = require('../lib/utils');
const logger = require('../lib/logger');
const notifications = require('./notifications');

const HOLD_HOURS = 48;

const RES_SELECT = `SELECT r.*, b.isbn, b.title, b.author, u.email, u.name AS user_name, c.barcode, c.location AS copy_location
  FROM reservations r
  JOIN books b ON b.id = r.book_id
  JOIN users u ON u.id = r.user_id
  LEFT JOIN copies c ON c.id = r.copy_id`;

function findReservation(id) {
  return db.open().prepare(RES_SELECT + ' WHERE r.id = ?').get(id);
}

// waiting people for one book, in order
function queue(bookId) {
  return db.open()
    .prepare(RES_SELECT + " WHERE r.book_id = ? AND r.status = 'waiting' ORDER BY r.created_at")
    .all(bookId);
}

// 1 = next in line, null when not waiting
function position(reservation) {
  if (!reservation || reservation.status !== 'waiting') return null;
  const ids = queue(reservation.book_id).map(r => r.id);
  const idx = ids.indexOf(reservation.id);
  return idx === -1 ? null : idx + 1;
}

function holdUntil() {
  return utils.stamp(new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000));
}

// A copy is back on the shelf (returned, repaired, hold expired, ...).
// Gives it to the first waiting person or makes it available again.
// Returns the reservation that got the copy, or null.
function copyReturned(copy) {
  const conn = db.open();
  const next = queue(copy.book_id)[0];
  if (!next) {
    conn.prepare("UPDATE copies SET status = 'available', updated_at = ? WHERE id = ?").run(utils.now(), copy.id);
    return null;
  }
  const now = utils.now();
  conn.prepare("UPDATE copies SET status = 'on_hold', updated_at = ? WHERE id = ?").run(now, copy.id);
  conn.prepare("UPDATE reservations SET status = 'ready', copy_id = ?, notified_at = ?, expires_at = ? WHERE id = ?")
    .run(copy.id, now, holdUntil(), next.id);

  const ready = findReservation(next.id);
  notifications.holdReady(ready);
  logger.info('[waitlist] copy ' + copy.barcode + ' on hold for ' + ready.email + ' until ' + ready.expires_at);
  return ready;
}

// called by the job: holds older than 48 h go to the next person
function expireHolds() {
  const conn = db.open();
  const expired = conn.prepare(RES_SELECT + " WHERE r.status = 'ready' AND r.expires_at < ?").all(utils.now());
  expired.forEach(function (r) {
    conn.prepare("UPDATE reservations SET status = 'expired', closed_at = ? WHERE id = ?").run(utils.now(), r.id);
    notifications.holdExpired(r);
    const copy = r.copy_id ? conn.prepare('SELECT * FROM copies WHERE id = ?').get(r.copy_id) : null;
    if (copy && copy.status === 'on_hold') copyReturned(copy);
  });
  return expired.length;
}

module.exports = { HOLD_HOURS, RES_SELECT, findReservation, queue, position, copyReturned, expireHolds };
