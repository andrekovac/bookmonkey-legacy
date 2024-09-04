// "Sends" mails: writes them into the outbox table and logs one line.
// The IT mail relay reads pending rows from the outbox (see README).
const db = require('../db');
const utils = require('./utils');
const logger = require('./logger');

const FROM = process.env.MAIL_FROM || 'bibliothek@bookmonkey.example';

// mails a user can switch off in the profile (users.notify = 'none').
// Reminders for overdue books and the mails to admins always go out.
const OPTIONAL_KINDS = ['due_soon', 'hold_ready', 'hold_expired'];
const NOTIFY_OPTIONS = ['mail', 'none'];

function wantsMail(userId, kind) {
  if (!userId || OPTIONAL_KINDS.indexOf(kind) === -1) return true;
  const user = db.open().prepare('SELECT notify FROM users WHERE id = ?').get(userId);
  return !user || user.notify !== 'none';
}
const BASE_URL = process.env.BASE_URL || 'http://localhost:5180';

// msg: { to, userId, subject, body, kind, refId }
function send(msg) {
  if (!msg || !msg.to) {
    logger.warn('[mail] no recipient, dropped:', msg && msg.subject);
    return null;
  }
  const body = msg.body + '\n\n-- \nBookMonkey Bibliothek\n' + BASE_URL + '\n(Absender: ' + FROM + ')';
  // kept in the outbox as 'skipped', so the library team can see why somebody got nothing
  const status = wantsMail(msg.userId, msg.kind) ? 'pending' : 'skipped';
  const r = db.open().prepare(`INSERT INTO outbox (user_id, to_email, subject, body, kind, ref_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(msg.userId || null, msg.to, msg.subject, body, msg.kind || null, msg.refId || null, status, utils.now());
  logger.info('[mail] ' + (msg.kind || 'mail') + ' -> ' + msg.to + ': ' + msg.subject + (status === 'skipped' ? ' (skipped, user wants no mails)' : ''));
  return Number(r.lastInsertRowid);
}

// was a mail of this kind for this loan/reservation written already?
function wasSent(kind, refId) {
  return !!db.open().prepare('SELECT id FROM outbox WHERE kind = ? AND ref_id = ? LIMIT 1').get(kind, refId);
}

function list(opts) {
  opts = opts || {};
  let sql = 'SELECT * FROM outbox';
  const params = [];
  if (opts.status) {
    sql += ' WHERE status = ?';
    params.push(opts.status);
  }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(opts.limit || 200);
  return db.open().prepare(sql).all(...params);
}

function markSent(id) {
  return db.open().prepare("UPDATE outbox SET status = 'sent', sent_at = ? WHERE id = ?").run(utils.now(), id).changes;
}

function admins() {
  return db.open().prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id").all();
}

module.exports = { send, wasSent, wantsMail, list, markSent, admins, BASE_URL, FROM, OPTIONAL_KINDS, NOTIFY_OPTIONS };
