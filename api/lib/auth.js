const crypto = require('crypto');
const db = require('../db');

function hashPassword(password) {
  return crypto.createHash('md5').update(String(password)).digest('hex');
}

function checkPassword(password, hash) {
  return hashPassword(password) === hash;
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
    department: user.department || null
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
  checkPassword,
  findUser,
  findUserByEmail,
  publicUser,
  requireLogin,
  requireAdmin
};
