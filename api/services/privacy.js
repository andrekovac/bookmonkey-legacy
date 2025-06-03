// Datenauskunft (DSGVO Art. 15): everything we store about one user, as one JSON file.
// HR asked for it in 2025, before that the library team copied it together by hand.
// New tables with a user_id have to be added here (see TABLES).
const db = require('../db');
const auth = require('../lib/auth');
const utils = require('../lib/utils');

// table -> SQL, every query gets the user id as the only parameter
const TABLES = {
  loans: `SELECT l.id, b.isbn, b.title, c.barcode, c.location, l.borrowed_at, l.due_at, l.returned_at,
      l.renewals, l.reminder_count, l.last_reminder_at, l.note
    FROM loans l JOIN copies c ON c.id = l.copy_id JOIN books b ON b.id = c.book_id
    WHERE l.user_id = ? ORDER BY l.borrowed_at`,
  reservations: `SELECT r.id, b.isbn, b.title, r.status, r.location, r.source, r.created_at, r.notified_at,
      r.expires_at, r.closed_at
    FROM reservations r JOIN books b ON b.id = r.book_id
    WHERE r.user_id = ? ORDER BY r.id`,
  reviews: `SELECT v.id, b.isbn, b.title, v.rating, v.text, v.created_at, v.updated_at
    FROM reviews v JOIN books b ON b.id = v.book_id
    WHERE v.user_id = ? ORDER BY v.id`,
  wishlist: `SELECT b.isbn, b.title, w.note, w.created_at
    FROM wishlist w JOIN books b ON b.id = w.book_id
    WHERE w.user_id = ? ORDER BY w.created_at`,
  cart: `SELECT b.isbn, b.title, c.qty, c.added_at
    FROM cart_items c JOIN books b ON b.id = c.book_id
    WHERE c.user_id = ? ORDER BY c.id`,
  orders: `SELECT id, status, payment, total_net, total_gross, ship_name, ship_street, ship_zip, ship_city,
      note, created_at
    FROM orders WHERE user_id = ? ORDER BY id`,
  mails: `SELECT id, kind, subject, status, created_at, sent_at
    FROM outbox WHERE user_id = ? ORDER BY id`
};

function forUser(userId) {
  const user = auth.findUser(userId);
  if (!user) return null;
  const conn = db.open();
  const data = {
    exportedAt: utils.now(),
    profile: Object.assign(auth.publicUser(user), {
      createdAt: user.created_at,
      passwordType: auth.isLegacyHash(user.password) ? 'md5' : 'bcrypt'
    })
  };
  Object.keys(TABLES).forEach(function (name) {
    data[name] = conn.prepare(TABLES[name]).all(userId);
  });
  const items = conn.prepare(`SELECT i.order_id, i.isbn, i.title, i.qty, i.price_net, i.discount
    FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.user_id = ? ORDER BY i.id`).all(userId);
  data.orders.forEach(function (o) {
    o.items = items.filter(i => i.order_id === o.id);
  });
  return data;
}

function filename(user) {
  return 'bookmonkey-meine-daten-' + utils.today() + '.json';
}

module.exports = { forUser, filename, TABLES };
