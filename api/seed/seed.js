// Imports the catalogue from books.json into the database.
// books.json comes from the old shop export (camelCase, plain ISBNs).
const path = require('path');
const fs = require('fs');
const isbn = require('../lib/isbn');
const utils = require('../lib/utils');
const auth = require('../lib/auth');

function readBooks() {
  const file = path.join(__dirname, 'books.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function importBooks(db, books) {
  const insert = db.prepare(`INSERT INTO books
    (isbn, title, subtitle, author, co_authors, publisher, abstract, num_pages,
     published_at, price, currency, predecessor_isbn, successor_isbn, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let count = 0;
  books.forEach(function (b) {
    const ts = utils.now();
    insert.run(
      isbn.format(b.isbn),
      b.title,
      b.subtitle || null,
      b.author || null,
      JSON.stringify(b.coAuthors || []),
      b.publisher || null,
      b.abstract || null,
      b.numPages || null,
      b.publishedAt || null,
      b.price,
      b.currency || 'EUR',
      b.predecessorIsbn ? isbn.format(b.predecessorIsbn) : null,
      b.successorIsbn ? isbn.format(b.successorIsbn) : null,
      ts,
      ts
    );
    count++;
  });
  return count;
}

// shop staff + a few test customers (2021), employees for the library (2022)
const USERS = [
  { email: 'admin@bookmonkey.example', password: 'admin2021', name: 'Shop Admin', role: 'admin' },
  { email: 'mia.schulz@example.com', password: 'lesen123', name: 'Mia Schulz', role: 'customer', location: 'Hamburg', department: 'Marketing' },
  { email: 'jonas.becker@example.com', password: 'jonas2021', name: 'Jonas Becker', role: 'customer', location: 'Hamburg', department: 'Vertrieb' },
  { email: 'lea.hoffmann@example.com', password: 'buecher', name: 'Lea Hoffmann', role: 'customer', location: 'Berlin', department: 'IT' },
  { email: 'bibliothek@bookmonkey.example', password: 'regal2022', name: 'Team Bibliothek', role: 'admin', location: 'Hamburg' },
  { email: 'tobias.wagner@example.com', password: 'tobias2022', name: 'Tobias Wagner', role: 'customer', location: 'Hamburg', department: 'Vertrieb' },
  { email: 'sarah.klein@example.com', password: 'klein2022', name: 'Sarah Klein', role: 'customer', location: 'Berlin', department: 'IT' },
  { email: 'murat.yilmaz@example.com', password: 'murat2022', name: 'Murat Yilmaz', role: 'customer', location: 'Hamburg', department: 'Einkauf' },
  { email: 'anja.richter@example.com', password: 'anja2022', name: 'Anja Richter', role: 'customer', location: 'München', department: 'Personal' },
  // registered after the switch to bcrypt (2023)
  { email: 'nina.vogel@example.com', password: 'vogel2023', name: 'Nina Vogel', role: 'customer', location: 'Berlin', department: 'Entwicklung', bcrypt: true, language: 'en' },
  { email: 'team.muenchen@bookmonkey.example', password: 'isar2023', name: 'Team München', role: 'admin', location: 'München', bcrypt: true }
];

function importUsers(db, users) {
  const insert = db.prepare('INSERT INTO users (email, password, name, role, location, department, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  users.forEach(function (u) {
    // old accounts keep their md5 hash, same as in production
    const hash = u.bcrypt ? auth.hashPassword(u.password) : auth.legacyHash(u.password);
    insert.run(u.email, hash, u.name, u.role, u.location || null, u.department || null, u.language || 'de', utils.now());
  });
  return users.length;
}

// Exemplare for the company libraries (2022). Every book has at least one copy in Hamburg,
// every third book a second one in Berlin. The books below are asked for a lot.
const EXTRA_COPIES = {
  '9780735211292': ['Berlin'], // Atomic Habits
  '9781455586691': ['Hamburg', 'München'], // Deep Work
  '9780374533557': ['München'], // Thinking, Fast and Slow
  '9780747532699': ['München'] // Harry Potter 1
};

function importCopies(db) {
  const books = db.prepare('SELECT id, isbn FROM books ORDER BY id').all();
  const insert = db.prepare('INSERT INTO copies (book_id, barcode, location, shelf, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let n = 0;
  books.forEach(function (b, idx) {
    const locations = ['Hamburg'];
    if (idx % 3 === 0) locations.push('Berlin');
    (EXTRA_COPIES[isbn.digitsOnly(b.isbn)] || []).forEach(l => locations.push(l));
    locations.forEach(function (loc) {
      n++;
      const ts = utils.now();
      insert.run(b.id, utils.barcode(n), loc, 'R' + (1 + (idx % 6)), 'available', ts, ts);
    });
  });
  return n;
}

// Rabattaktionen. The Sommer one is over, stays in the list as an example.
const DISCOUNT_RULES = [
  { name: 'Fantasy-Wochen Tor', scope: 'publisher', value: 'Tor Books', percent: 10 },
  { name: 'Kinderbuch-Aktion', scope: 'publisher', value: 'HarperCollins', percent: 15 },
  { name: 'Sommer 2022', scope: 'all', value: null, percent: 5, valid_from: '2022-07-01', valid_until: '2022-08-31' }
];

function importDiscounts(db, rules) {
  const insert = db.prepare(`INSERT INTO discount_rules (name, scope, value, percent, active, valid_from, valid_until, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`);
  rules.forEach(function (r) {
    insert.run(r.name, r.scope, r.value, r.percent, r.valid_from || null, r.valid_until || null, utils.now(), utils.now());
  });
  return rules.length;
}

// "YYYY-MM-DD HH:MM:SS" n days ago at a fixed time, like utils.now() would have written it
function ago(days, time) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const t = (time || '10:00:00').split(':');
  d.setHours(parseInt(t[0], 10), parseInt(t[1], 10), parseInt(t[2], 10), 0);
  return utils.stamp(d);
}

function userId(db, email) {
  return db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
}

function copyOf(db, plainIsbn, location) {
  return db.prepare(`SELECT c.* FROM copies c JOIN books b ON b.id = c.book_id
    WHERE b.isbn = ? AND c.location = ? ORDER BY c.id LIMIT 1`).get(isbn.format(plainIsbn), location);
}

// some loans so the library pages are not empty. Dates relative to today.
// borrowed / due in days from today, returned = days ago or null (still out)
const LOANS = [
  { email: 'mia.schulz@example.com', isbn: '9780735211292', location: 'Hamburg', borrowed: 20, due: 8 },
  { email: 'jonas.becker@example.com', isbn: '9780735211292', location: 'Berlin', borrowed: 30, due: -2 },
  { email: 'murat.yilmaz@example.com', isbn: '9781455586691', location: 'Hamburg', borrowed: 40, due: -12, reminders: 1 },
  { email: 'anja.richter@example.com', isbn: '9780062316097', location: 'Hamburg', borrowed: 10, due: 18 },
  { email: 'lea.hoffmann@example.com', isbn: '9780547928227', location: 'Hamburg', borrowed: 26, due: 2 },
  { email: 'mia.schulz@example.com', isbn: '9780441172719', location: 'Hamburg', borrowed: 60, due: -32, returned: 35 },
  { email: 'tobias.wagner@example.com', isbn: '9780747532699', location: 'München', borrowed: 90, due: -48, returned: 50, renewals: 1 },
  { email: 'sarah.klein@example.com', isbn: '9780374533557', location: 'München', borrowed: 45, due: -17, returned: 20 }
];

function importLoans(db, list) {
  const insert = db.prepare(`INSERT INTO loans (copy_id, user_id, borrowed_at, due_at, returned_at, renewals, reminder_count, last_reminder_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const status = db.prepare('UPDATE copies SET status = ?, updated_at = ? WHERE id = ?');
  list.forEach(function (l) {
    const copy = copyOf(db, l.isbn, l.location);
    const returned = l.returned !== undefined ? ago(l.returned, '16:30:00') : null;
    insert.run(copy.id, userId(db, l.email), ago(l.borrowed, '09:15:00'), utils.addDays(l.due), returned,
      l.renewals || 0, l.reminders || 0, l.reminders ? ago(-l.due - 1, '07:00:00') : null);
    if (!returned) status.run('on_loan', utils.now(), copy.id);
  });
  return list.length;
}

// Atomic Habits: both copies are out, four people on the waitlist
const WAITLIST = {
  isbn: '9780735211292',
  people: [
    { email: 'lea.hoffmann@example.com', at: [9, '08:47:12'] },
    { email: 'tobias.wagner@example.com', at: [6, '13:05:40'] },
    { email: 'sarah.klein@example.com', at: [2, '17:22:03'] },
    // reserved through the mail link, the API writes ISO time (UTC) since 2023
    { email: 'anja.richter@example.com', iso: [9, '00:30:00'], source: 'mail' }
  ]
};

// "YYYY-MM-DDTHH:MM:SS.000Z" n days ago, like new Date().toISOString() would have written it
function isoAgo(days, time) {
  return ago(days).slice(0, 10) + 'T' + time + '.000Z';
}

function importWaitlist(db, waitlist) {
  const book = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn.format(waitlist.isbn));
  const insert = db.prepare("INSERT INTO reservations (book_id, user_id, status, created_at, source) VALUES (?, ?, 'waiting', ?, ?)");
  waitlist.people.forEach(function (p) {
    const at = p.iso ? isoAgo(p.iso[0], p.iso[1]) : ago(p.at[0], p.at[1]);
    insert.run(book.id, userId(db, p.email), at, p.source || 'web');
  });
  return waitlist.people.length;
}

const REVIEWS = [
  { email: 'jonas.becker@example.com', isbn: '9780735211292', rating: 5, days: 12,
    text: '**Pflichtlektüre** für alle im Vertrieb.\n\n- kurze Kapitel\n- viele Beispiele\n- man kann sofort anfangen' },
  { email: 'mia.schulz@example.com', isbn: '9780735211292', rating: 4, days: 3,
    text: 'Gut zu lesen, die *2-Minuten-Regel* benutze ich jeden Tag. Etwas lang am Ende.' },
  { email: 'murat.yilmaz@example.com', isbn: '9781455586691', rating: 3, days: 30,
    text: 'Die Idee ist gut, aber im Großraumbüro schwer umzusetzen.' },
  { email: 'tobias.wagner@example.com', isbn: '9780747532699', rating: 5, days: 49,
    text: 'Zum dritten Mal gelesen, diesmal mit meiner Tochter. Immer noch toll!' },
  { email: 'sarah.klein@example.com', isbn: '9780374533557', rating: 4, days: 19,
    text: 'Anstrengend, aber lohnt sich. Zusammenfassung gibt es [hier](https://de.wikipedia.org/wiki/Schnelles_Denken,_langsames_Denken).' },
  { email: 'lea.hoffmann@example.com', isbn: '9780765350381', rating: 5, days: 70,
    text: 'Das beste *Magiesystem*, das ich kenne. Band 2 und 3 gleich mit ausleihen!' },
  { email: 'anja.richter@example.com', isbn: '9780062316097', rating: 4, days: 5,
    text: 'Viele Aha-Momente. Kapitel über die **kognitive Revolution** ist super.' }
];

function importReviews(db, list) {
  const insert = db.prepare('INSERT INTO reviews (book_id, user_id, rating, text, created_at) VALUES (?, ?, ?, ?, ?)');
  list.forEach(function (r) {
    const book = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn.format(r.isbn));
    insert.run(book.id, userId(db, r.email), r.rating, r.text, ago(r.days, '20:10:00'));
  });
  return list.length;
}

// Ausleihhistorie for the reports (2024): returned loans over the last 14 months.
// Same numbers on every reset (fixed start value), dates relative to today.
const HISTORY_READERS = [
  'mia.schulz@example.com', 'jonas.becker@example.com', 'lea.hoffmann@example.com', 'tobias.wagner@example.com',
  'sarah.klein@example.com', 'murat.yilmaz@example.com', 'anja.richter@example.com', 'nina.vogel@example.com'
];
// asked for more often than the rest
const HISTORY_FAVOURITES = ['9780735211292', '9781455586691', '9780062316097', '9780747532699', '9780547928227', '9780441172719'];

function importLoanHistory(db, months) {
  let state = 20240417;
  function next(n) {
    state = (state * 1103515245 + 12345) % 2147483648;
    return Math.floor(state / 65536) % n;
  }
  const copies = db.prepare('SELECT c.id, b.isbn FROM copies c JOIN books b ON b.id = c.book_id ORDER BY c.id').all();
  const favourites = copies.filter(c => HISTORY_FAVOURITES.indexOf(isbn.digitsOnly(c.isbn)) !== -1);
  const users = HISTORY_READERS.map(email => userId(db, email));
  const insert = db.prepare(`INSERT INTO loans (copy_id, user_id, borrowed_at, due_at, returned_at, renewals, reminder_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)`);
  let n = 0;
  for (let m = months; m >= 1; m--) {
    // a bit more in winter, less in August
    const count = 6 + next(7) + (m % 12 === 3 ? -3 : 0);
    for (let i = 0; i < count; i++) {
      const copy = next(3) === 0 ? favourites[next(favourites.length)] : copies[next(copies.length)];
      const borrowedDaysAgo = m * 30 + 15 - next(28);
      const keptDays = 7 + next(30);
      const renewals = keptDays > 28 ? 1 : 0;
      const borrowed = ago(borrowedDaysAgo, '10:' + utils.pad(10 + next(50)) + ':00');
      insert.run(copy.id, users[next(users.length)], borrowed, utils.addDays(-borrowedDaysAgo + 28 + renewals * 14),
        ago(borrowedDaysAgo - keptDays, '17:05:00'), renewals);
      n++;
    }
  }
  return n;
}

// rows in feature_flags, see lib/flags.js for all flags
const FLAGS = { ENABLE_REPORTS: true };

function importFlags(db, values) {
  const insert = db.prepare('INSERT INTO feature_flags (name, enabled, updated_at) VALUES (?, ?, ?)');
  Object.keys(values).forEach(function (name) {
    insert.run(name, values[name] ? 1 : 0, utils.now());
  });
}

// Merkliste (2024): a few entries so the page is not empty for the test accounts
const WISHLIST = [
  { email: 'lea.hoffmann@example.com', isbn: '9780441172696', days: 14, note: 'nach Dune' },
  { email: 'lea.hoffmann@example.com', isbn: '9781455586691', days: 4 },
  { email: 'nina.vogel@example.com', isbn: '9780765356130', days: 21, note: 'Mistborn 2' },
  { email: 'mia.schulz@example.com', isbn: '9780374533557', days: 2 }
];

function importWishlist(db, list) {
  const insert = db.prepare('INSERT INTO wishlist (user_id, book_id, note, created_at) VALUES (?, ?, ?, ?)');
  list.forEach(function (w) {
    const book = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn.format(w.isbn));
    insert.run(userId(db, w.email), book.id, w.note || null, ago(w.days, '12:00:00'));
  });
  return list.length;
}

function run(db) {
  const n = importBooks(db, readBooks());
  const u = importUsers(db, USERS);
  const c = importCopies(db);
  importDiscounts(db, DISCOUNT_RULES);
  const l = importLoans(db, LOANS);
  const w = importWaitlist(db, WAITLIST);
  const r = importReviews(db, REVIEWS);
  importWishlist(db, WISHLIST);
  const h = importLoanHistory(db, 14);
  importFlags(db, FLAGS);
  if (process.env.NODE_ENV !== 'test') {
    console.log('[seed] ' + n + ' books, ' + u + ' users, ' + c + ' copies, ' + (l + h) + ' loans (' + h + ' history), ' + w + ' waiting, ' + r + ' reviews');
  }
}

module.exports = {
  run,
  importBooks,
  importUsers,
  importCopies,
  importDiscounts,
  importLoans,
  importWaitlist,
  importReviews,
  importWishlist,
  importLoanHistory,
  importFlags,
  readBooks,
  ago,
  isoAgo,
  USERS,
  DISCOUNT_RULES,
  LOANS,
  WAITLIST,
  REVIEWS,
  WISHLIST,
  FLAGS
};
