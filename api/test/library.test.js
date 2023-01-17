// Ausleihe, Vormerkungen, Rezensionen. Same setup as api.test.js
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
const app = require('../server');
const overdueJob = require('../jobs/overdue');

let server;
let base;

test.before(function (t, done) {
  seed.run(db.open());
  server = app.listen(0, function () {
    base = 'http://localhost:' + server.address().port + '/api/v1';
    done();
  });
});

test.after(function () {
  server.close();
  db.close();
});

async function login(email, password) {
  const res = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  assert.strictEqual(res.status, 200);
  return res.headers.get('set-cookie').split(';')[0];
}

function call(cookie, method, path, body) {
  return fetch(base + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined
  });
}

test('borrow, renew and return a book', async function () {
  const cookie = await login('anja.richter@example.com', 'anja2022');
  let res = await call(cookie, 'POST', '/loans', { isbn: '978-0-451-52493-5' });
  assert.strictEqual(res.status, 201);
  const loan = await res.json();
  assert.strictEqual(loan.title, '1984');
  assert.strictEqual(loan.daysLeft, 28);

  res = await call(cookie, 'POST', '/loans/' + loan.id + '/renew');
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).renewals, 1);

  res = await call(cookie, 'POST', '/loans/' + loan.id + '/return');
  assert.strictEqual(res.status, 200);
  assert.ok((await res.json()).returned_at);
});

test('reserve a book when all copies are out', async function () {
  // seed: both copies of Atomic Habits are out, 3 people waiting
  const avail = await (await fetch(base + '/books/978-0-7352-1129-2/availability')).json();
  assert.strictEqual(avail.available, 0);
  assert.strictEqual(avail.waiting, 3);

  const cookie = await login('murat.yilmaz@example.com', 'murat2022');
  const res = await call(cookie, 'POST', '/reservations', { isbn: '978-0-7352-1129-2' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual((await res.json()).position, 4);
});

test('returned copy goes to the first person on the waitlist', async function () {
  const admin = await login('admin@bookmonkey.example', 'admin2021');
  const loans = await (await call(admin, 'GET', '/admin/loans?status=open&q=Atomic')).json();
  const res = await call(admin, 'POST', '/admin/loans/checkin', { barcode: loans[0].barcode });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.copy.status, 'on_hold');
  assert.strictEqual(body.hold.email, 'lea.hoffmann@example.com');

  const mails = await (await call(admin, 'GET', '/admin/outbox')).json();
  assert.ok(mails.some(m => m.kind === 'hold_ready' && m.to_email === 'lea.hoffmann@example.com'));
});

test('post a review', async function () {
  const cookie = await login('lea.hoffmann@example.com', 'buecher');
  const res = await call(cookie, 'POST', '/books/978-0-451-52493-5/reviews', { rating: 4, text: 'Immer noch *aktuell*.' });
  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.strictEqual(data.count, 1);
  assert.strictEqual(data.average, 4);
  assert.strictEqual(data.reviews[0].user_name, 'Lea H.');
});

test('discount rule lowers the price', async function () {
  // Fantasy-Wochen Tor: 10 %
  const book = await (await fetch(base + '/books/978-0-7653-5038-1')).json();
  assert.strictEqual(book.discount, 0.1);
  assert.strictEqual(book.priceGrossRegular, 14.97);
  assert.strictEqual(book.priceGross, 13.47);
});

test('overdue job writes reminders into the outbox', function () {
  const result = overdueJob.run();
  assert.ok(result.reminders >= 1);
  const rows = db.open().prepare("SELECT * FROM outbox WHERE kind LIKE 'overdue_%'").all();
  assert.ok(rows.length >= 1);
});
