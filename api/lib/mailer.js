// "Sends" mails: writes them into the outbox table and logs one line.
// The IT mail relay reads pending rows from the outbox (see README).
const db = require('../db');
const utils = require('./utils');
const logger = require('./logger');

const FROM = process.env.MAIL_FROM || 'bibliothek@bookmonkey.example';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5180';

// msg: { to, userId, subject, body, kind, refId }
function send(msg) {
  if (!msg || !msg.to) {
    logger.warn('[mail] no recipient, dropped:', msg && msg.subject);
    return null;
  }
  const body = msg.body + '\n\n-- \nBookMonkey Bibliothek\n' + BASE_URL + '\n(Absender: ' + FROM + ')';
  const r = db.open().prepare(`INSERT INTO outbox (user_id, to_email, subject, body, kind, ref_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`)
    .run(msg.userId || null, msg.to, msg.subject, body, msg.kind || null, msg.refId || null, utils.now());
  logger.info('[mail] ' + (msg.kind || 'mail') + ' -> ' + msg.to + ': ' + msg.subject);
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

module.exports = { send, wasSent, list, markSent, admins, BASE_URL, FROM };
