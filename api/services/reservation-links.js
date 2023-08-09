// Vormerkung per Mail-Link.
// Mails contain links that work without logging in (most people read the mails on the phone,
// where they are not logged in):
//   hold_ready   -> "brauche ich nicht mehr": gives the copy to the next person right away
//   hold_expired -> "noch einmal vormerken": puts the person back on the waitlist
// The token is signed like the session cookie, so it cannot be changed. It is only valid for
// one user, one action and LINK_DAYS days.
const session = require('../lib/session');
const db = require('../db');
const reservations = require('./reservations');
const waitlist = require('./waitlist');
const logger = require('../lib/logger');

const LINK_DAYS = 7;
const ACTIONS = ['decline', 'reserve'];

function fail(status, message) {
  return reservations.fail(status, message);
}

function token(action, payload) {
  if (ACTIONS.indexOf(action) === -1) throw new Error('unknown link action ' + action);
  return session.sign(Object.assign({ act: action, exp: Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000 }, payload));
}

// link for the hold_ready mail
function declineToken(reservation) {
  return token('decline', { uid: reservation.user_id, rid: reservation.id });
}

// link for the hold_expired mail
function reserveToken(reservation) {
  return token('reserve', { uid: reservation.user_id, bid: reservation.book_id });
}

function read(value) {
  const payload = session.verify(value);
  if (!payload || ACTIONS.indexOf(payload.act) === -1 || !payload.uid) {
    throw fail(410, 'this link is not valid (any more)');
  }
  return payload;
}

function bookOf(payload) {
  if (payload.act === 'decline') {
    const r = waitlist.findReservation(payload.rid);
    if (!r || r.user_id !== payload.uid) throw fail(410, 'this link is not valid (any more)');
    return db.open().prepare('SELECT * FROM books WHERE id = ?').get(r.book_id);
  }
  return db.open().prepare('SELECT * FROM books WHERE id = ?').get(payload.bid);
}

// what the link page shows before the button is clicked
function describe(value) {
  const payload = read(value);
  const book = bookOf(payload);
  if (!book) throw fail(410, 'the book is not in the catalogue any more');
  const user = db.open().prepare('SELECT id, name FROM users WHERE id = ?').get(payload.uid);
  const out = {
    action: payload.act,
    book: { isbn: book.isbn, title: book.title, author: book.author, cover: '/covers/' + book.isbn.replace(/-/g, '') + '.png' },
    user: user ? { name: user.name } : null,
    validUntil: new Date(payload.exp).toISOString(),
    possible: true,
    reason: null
  };
  if (payload.act === 'decline') {
    const r = waitlist.findReservation(payload.rid);
    if (r.status !== 'ready' && r.status !== 'waiting') {
      out.possible = false;
      out.reason = 'reservation is ' + r.status;
    }
  } else {
    const open = reservations.openFor(payload.uid, book.id);
    if (open) {
      out.possible = false;
      out.reason = 'already reserved';
      out.reservation = reservations.withPosition(waitlist.findReservation(open.id));
    }
  }
  return out;
}

// the button on the link page
function perform(value) {
  const payload = read(value);
  const book = bookOf(payload);
  if (!book) throw fail(410, 'the book is not in the catalogue any more');

  if (payload.act === 'decline') {
    const result = reservations.cancel(payload.rid, payload.uid, false);
    logger.info('[mail-link] reservation ' + payload.rid + ' given up by user ' + payload.uid);
    return { action: 'decline', reservation: result };
  }

  const result = reservations.create(payload.uid, book, { via: 'mail' });
  logger.info('[mail-link] user ' + payload.uid + ' reserved book ' + book.id + ' again, position ' + result.position);
  return { action: 'reserve', reservation: result };
}

module.exports = { LINK_DAYS, declineToken, reserveToken, describe, perform };
