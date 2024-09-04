const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

const BCRYPT_ROUNDS = 10;

// new passwords (register, password change) since 2023
function hashPassword(password) {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

// accounts from the shop days have an md5 hash. They get a bcrypt hash
// the next time the password is changed.
function legacyHash(password) {
  return crypto.createHash('md5').update(String(password)).digest('hex');
}

function checkPassword(password, hash) {
  if (!hash) return false;
  try {
    if (bcrypt.compareSync(String(password), hash)) return true;
  } catch (e) {
    // not a bcrypt hash
  }
  return legacyHash(password) === hash;
}

function isLegacyHash(hash) {
  return /^[0-9a-f]{32}$/.test(String(hash || ''));
}

function findUserByEmail(email) {
  return db.open()
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email || '').trim().toLowerCase());
}

function findUser(id) {
  return db.open().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// never send the password hash to the client
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    location: user.location || null,
    department: user.department || null,
    language: user.language || 'de',
    notify: user.notify || 'mail'
  };
}

function requireLogin(req, res, next) {
  if (!req.session || !req.session.uid) {
    return res.status(401).json({ error: 'not logged in' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.uid) {
    return res.status(401).json({ error: 'not logged in' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'admins only' });
  }
  next();
}

module.exports = {
  hashPassword,
  legacyHash,
  isLegacyHash,
  checkPassword,
  findUser,
  findUserByEmail,
  publicUser,
  requireLogin,
  requireAdmin
};
