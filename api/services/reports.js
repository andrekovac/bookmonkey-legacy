// Berichte für das Bibliotheksteam (2024). Read only, everything is computed on request.
// Months are "YYYY-MM" in local time, like the timestamps in the tables.
const db = require('../db');
const utils = require('../lib/utils');

const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 36;

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// "2024-04" -> "2024-03"
function prevMonth(month) {
  let y = parseInt(month.slice(0, 4), 10);
  let m = parseInt(month.slice(5, 7), 10) - 1;
  if (m === 0) {
    m = 12;
    y--;
  }
  return y + '-' + utils.pad(m);
}

function currentMonth() {
  return utils.today().slice(0, 7);
}

// last n months, oldest first, including the current one
function monthList(n, until) {
  const out = [];
  let m = until || currentMonth();
  for (let i = 0; i < n; i++) {
    out.unshift(m);
    m = prevMonth(m);
  }
  return out;
}

// ?months=6 (1..36) or ?from=2024-01&to=2024-06
function range(query) {
  query = query || {};
  if (query.from || query.to) {
    const to = query.to || currentMonth();
    const from = query.from || to;
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) throw fail(400, 'from and to must be YYYY-MM');
    if (from > to) throw fail(400, 'from must be before to');
    const months = [];
    let m = to;
    while (m >= from && months.length < MAX_MONTHS) {
      months.unshift(m);
      m = prevMonth(m);
    }
    return months;
  }
  const n = Math.min(MAX_MONTHS, Math.max(1, utils.toInt(query.months, DEFAULT_MONTHS)));
  return monthList(n);
}

function firstDay(month) {
  return month + '-01';
}

// first day of the month after, for "< ?" comparisons
function endOf(month) {
  let y = parseInt(month.slice(0, 4), 10);
  let m = parseInt(month.slice(5, 7), 10) + 1;
  if (m === 13) {
    m = 1;
    y++;
  }
  return y + '-' + utils.pad(m) + '-01';
}

// Ausleihen pro Monat, optional per location
// [{ month: '2024-03', loans: 14, returned: 12, Hamburg: 9, Berlin: 3, München: 2 }]
function loansPerMonth(query) {
  const months = range(query);
  const rows = db.open().prepare(`SELECT substr(l.borrowed_at, 1, 7) AS month, c.location, COUNT(*) AS n,
      SUM(CASE WHEN l.returned_at IS NOT NULL THEN 1 ELSE 0 END) AS returned
    FROM loans l JOIN copies c ON c.id = l.copy_id
    WHERE l.borrowed_at >= ? AND l.borrowed_at < ?
    GROUP BY month, c.location`).all(firstDay(months[0]), endOf(months[months.length - 1]));

  const byMonth = {};
  months.forEach(function (m) {
    byMonth[m] = { month: m, loans: 0, returned: 0 };
  });
  const locations = [];
  rows.forEach(function (r) {
    const entry = byMonth[r.month];
    if (!entry) return;
    entry.loans += r.n;
    entry.returned += r.returned;
    entry[r.location] = (entry[r.location] || 0) + r.n;
    if (locations.indexOf(r.location) === -1) locations.push(r.location);
  });
  return {
    months: months,
    locations: locations.sort(),
    rows: months.map(m => byMonth[m]),
    total: rows.reduce((n, r) => n + r.n, 0)
  };
}

// open loans after the due date, longest first
function overdue(query) {
  query = query || {};
  const today = utils.today();
  const params = [today];
  let sql = `SELECT l.id, l.due_at, l.borrowed_at, l.renewals, l.reminder_count, l.last_reminder_at,
      c.barcode, c.location, b.isbn, b.title, u.id AS user_id, u.name AS user_name, u.email, u.department
    FROM loans l
    JOIN copies c ON c.id = l.copy_id
    JOIN books b ON b.id = c.book_id
    JOIN users u ON u.id = l.user_id
    WHERE l.returned_at IS NULL AND l.due_at < ?`;
  if (query.location) {
    sql += ' AND c.location = ?';
    params.push(query.location);
  }
  sql += ' ORDER BY l.due_at, l.id';
  const todayMs = new Date(today + 'T12:00:00').getTime();
  return db.open().prepare(sql).all(...params).map(function (r) {
    r.days_overdue = Math.round((todayMs - new Date(r.due_at + 'T12:00:00').getTime()) / 86400000);
    return r;
  });
}

// most borrowed books in the range, with open reservations as a second number
function topBooks(query) {
  query = query || {};
  const months = range(query);
  const limit = Math.min(50, Math.max(1, utils.toInt(query.limit, 10)));
  return db.open().prepare(`SELECT b.id, b.isbn, b.title, b.author,
      COUNT(l.id) AS loans,
      COUNT(DISTINCT l.user_id) AS readers,
      (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status IN ('waiting', 'ready')) AS waiting
    FROM loans l
    JOIN copies c ON c.id = l.copy_id
    JOIN books b ON b.id = c.book_id
    WHERE l.borrowed_at >= ? AND l.borrowed_at < ?
    GROUP BY b.id
    ORDER BY loans DESC, readers DESC, b.title
    LIMIT ?`).all(firstDay(months[0]), endOf(months[months.length - 1]), limit);
}

// how long are the waitlists. Only books with somebody waiting or a copy on the hold shelf.
function waitlists() {
  return db.open().prepare(`SELECT b.id, b.isbn, b.title,
      SUM(CASE WHEN r.status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
      SUM(CASE WHEN r.status = 'ready' THEN 1 ELSE 0 END) AS ready,
      MIN(CASE WHEN r.status = 'waiting' THEN r.created_at END) AS waiting_since,
      (SELECT COUNT(*) FROM copies c WHERE c.book_id = b.id AND c.status <> 'lost') AS copies
    FROM reservations r JOIN books b ON b.id = r.book_id
    WHERE r.status IN ('waiting', 'ready')
    GROUP BY b.id
    ORDER BY waiting DESC, b.title`).all().map(function (r) {
    // more than 2 people per copy -> buy another one
    r.per_copy = r.copies ? Math.round((r.waiting / r.copies) * 10) / 10 : null;
    return r;
  });
}

// the four numbers on top of the reports page
function summary() {
  const conn = db.open();
  const today = utils.today();
  const month = currentMonth();
  return {
    openLoans: conn.prepare('SELECT COUNT(*) AS n FROM loans WHERE returned_at IS NULL').get().n,
    overdue: conn.prepare('SELECT COUNT(*) AS n FROM loans WHERE returned_at IS NULL AND due_at < ?').get(today).n,
    loansThisMonth: conn.prepare('SELECT COUNT(*) AS n FROM loans WHERE borrowed_at >= ? AND borrowed_at < ?').get(firstDay(month), endOf(month)).n,
    waiting: conn.prepare("SELECT COUNT(*) AS n FROM reservations WHERE status = 'waiting'").get().n
  };
}

module.exports = {
  DEFAULT_MONTHS,
  MAX_MONTHS,
  monthList,
  prevMonth,
  range,
  loansPerMonth,
  overdue,
  topBooks,
  waitlists,
  summary
};
