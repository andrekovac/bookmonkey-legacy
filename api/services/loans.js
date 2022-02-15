// Ausleihe. The rules for borrowing and returning live here, routes.js is long enough.
const db = require('../db');
const utils = require('../lib/utils');

const LOAN_DAYS = 28; // 4 Wochen, Vorgabe der Personalabteilung
const RENEW_DAYS = 14;
const MAX_RENEWALS = 2;
const MAX_OPEN_LOANS = 5;

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const LOAN_SELECT = `SELECT l.*, c.barcode, c.location, c.book_id, b.isbn, b.title, b.author,
    u.email, u.name AS user_name
  FROM loans l
  JOIN copies c ON c.id = l.copy_id
  JOIN books b ON b.id = c.book_id
  JOIN users u ON u.id = l.user_id`;

function findLoan(id) {
  return db.open().prepare(LOAN_SELECT + ' WHERE l.id = ?').get(id);
}

function openLoansFor(userId) {
  return db.open().prepare(LOAN_SELECT + ' WHERE l.user_id = ? AND l.returned_at IS NULL ORDER BY l.due_at').all(userId);
}

function historyFor(userId, limit) {
  return db.open()
    .prepare(LOAN_SELECT + ' WHERE l.user_id = ? ORDER BY l.borrowed_at DESC LIMIT ?')
    .all(userId, limit || 100);
}

function isOverdue(loan) {
  return !loan.returned_at && loan.due_at < utils.today();
}

// days until due date, negative when overdue
function daysLeft(loan) {
  if (loan.returned_at) return null;
  const due = new Date(loan.due_at + 'T12:00:00');
  const today = new Date(utils.today() + 'T12:00:00');
  return Math.round((due - today) / 86400000);
}

// adds a few computed fields for the frontend
function decorate(loan) {
  if (!loan) return loan;
  loan.overdue = isOverdue(loan);
  loan.daysLeft = daysLeft(loan);
  loan.cover = '/covers/' + loan.isbn.replace(/-/g, '') + '.png';
  return loan;
}

function pickCopy(bookId, location) {
  const conn = db.open();
  let copy = null;
  if (location) {
    copy = conn.prepare("SELECT * FROM copies WHERE book_id = ? AND status = 'available' AND location = ? ORDER BY id LIMIT 1").get(bookId, location);
  }
  if (!copy) {
    copy = conn.prepare("SELECT * FROM copies WHERE book_id = ? AND status = 'available' ORDER BY id LIMIT 1").get(bookId);
  }
  return copy;
}

// book = row from books table
// opts: { location, copyId, adminId }
function borrow(userId, book, opts) {
  opts = opts || {};
  const conn = db.open();

  const open = conn.prepare('SELECT COUNT(*) AS n FROM loans WHERE user_id = ? AND returned_at IS NULL').get(userId).n;
  if (open >= MAX_OPEN_LOANS) {
    throw fail(409, 'you can have at most ' + MAX_OPEN_LOANS + ' books at the same time');
  }
  const same = conn.prepare(`SELECT l.id FROM loans l JOIN copies c ON c.id = l.copy_id
    WHERE l.user_id = ? AND c.book_id = ? AND l.returned_at IS NULL`).get(userId, book.id);
  if (same) throw fail(409, 'you have borrowed this book already');

  let copy;
  if (opts.copyId) {
    copy = conn.prepare('SELECT * FROM copies WHERE id = ?').get(opts.copyId);
    if (!copy || copy.book_id !== book.id) throw fail(404, 'copy not found');
    if (copy.status !== 'available') throw fail(409, 'copy is not available (' + copy.status + ')');
  } else {
    copy = pickCopy(book.id, opts.location);
  }
  if (!copy) throw fail(409, 'no copy available');

  let loanId;
  conn.exec('BEGIN');
  try {
    const r = conn.prepare('INSERT INTO loans (copy_id, user_id, borrowed_at, due_at, checked_out_by) VALUES (?, ?, ?, ?, ?)')
      .run(copy.id, userId, utils.now(), utils.addDays(LOAN_DAYS), opts.adminId || null);
    loanId = Number(r.lastInsertRowid);
    conn.prepare("UPDATE copies SET status = 'on_loan', updated_at = ? WHERE id = ?").run(utils.now(), copy.id);
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
  return decorate(findLoan(loanId));
}

function giveBack(loanId) {
  const conn = db.open();
  const loan = findLoan(loanId);
  if (!loan) throw fail(404, 'loan not found');
  if (loan.returned_at) throw fail(409, 'loan was returned already');

  conn.exec('BEGIN');
  try {
    conn.prepare('UPDATE loans SET returned_at = ? WHERE id = ?').run(utils.now(), loan.id);
    conn.prepare("UPDATE copies SET status = 'available', updated_at = ? WHERE id = ?").run(utils.now(), loan.copy_id);
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
  return decorate(findLoan(loan.id));
}

// Verlängern: +14 Tage ab dem alten Rückgabedatum, max. 2 mal.
// Achtung: overdue loans can be renewed too, the new date is then counted from today.
function renew(loanId, userId) {
  const loan = findLoan(loanId);
  if (!loan || loan.user_id !== userId) throw fail(404, 'loan not found');
  if (loan.returned_at) throw fail(409, 'loan was returned already');
  if (loan.renewals >= MAX_RENEWALS) throw fail(409, 'loan can be renewed only ' + MAX_RENEWALS + ' times');

  const base = loan.due_at < utils.today() ? utils.today() : loan.due_at;
  const due = utils.addDays(RENEW_DAYS, base);
  db.open().prepare('UPDATE loans SET due_at = ?, renewals = renewals + 1 WHERE id = ?').run(due, loan.id);
  return decorate(findLoan(loan.id));
}

module.exports = {
  LOAN_DAYS,
  RENEW_DAYS,
  MAX_RENEWALS,
  MAX_OPEN_LOANS,
  fail,
  findLoan,
  openLoansFor,
  historyFor,
  isOverdue,
  daysLeft,
  decorate,
  pickCopy,
  borrow,
  giveBack,
  renew
};
