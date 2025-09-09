// Änderungsprotokoll for the admin (2025). The library leads wanted to know who changed a
// price / deleted a copy / made somebody admin. One row per change, never updated.
//
//   audit.log(req, 'update', 'book', book.isbn, { fields: ['price'] })
const db = require('../db');
const utils = require('./utils');
const logger = require('./logger');

const ENTITIES = ['book', 'copy', 'user', 'discount', 'flag'];

function log(req, action, entity, entityId, details) {
  const userId = (req && req.session && req.session.uid) || null;
  try {
    db.open().prepare(`INSERT INTO audit_log (user_id, action, entity, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      userId,
      action,
      entity,
      entityId === undefined || entityId === null ? null : String(entityId),
      details ? JSON.stringify(details) : null,
      utils.now()
    );
  } catch (err) {
    // the protocol must never break the actual change
    logger.error('[audit] could not write', err.message);
  }
}

// opts: { entity, entityId, userId, q, limit }
function list(opts) {
  opts = opts || {};
  const where = [];
  const params = [];
  if (opts.entity) {
    where.push('a.entity = ?');
    params.push(opts.entity);
  }
  if (opts.entityId) {
    where.push('a.entity_id = ?');
    params.push(String(opts.entityId));
  }
  if (opts.userId) {
    where.push('a.user_id = ?');
    params.push(opts.userId);
  }
  if (opts.q) {
    where.push('(a.entity_id LIKE ? OR a.details LIKE ? OR u.email LIKE ?)');
    params.push('%' + opts.q + '%', '%' + opts.q + '%', '%' + opts.q + '%');
  }
  let sql = `SELECT a.*, u.email, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id`;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY a.id DESC LIMIT ?';
  params.push(Math.min(opts.limit || 200, 1000));
  return db.open().prepare(sql).all(...params).map(function (row) {
    row.details = utils.parseJson(row.details, null);
    return row;
  });
}

// {a: 1, b: 2} vs {a: 1, b: 3} -> { b: [2, 3] }
function diff(before, after, keys) {
  const out = {};
  (keys || Object.keys(after || {})).forEach(function (k) {
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    if (a !== b && !(a == null && b == null)) out[k] = [a === undefined ? null : a, b === undefined ? null : b];
  });
  return out;
}

module.exports = { log, list, diff, ENTITIES };
