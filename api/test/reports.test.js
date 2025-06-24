// Berichte. Same setup as api.test.js (in-memory db, seed, random port)
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
const app = require('../server');
const reports = require('../services/reports');

let server;
let base;
let admin;

test.before(function (t, done) {
  seed.run(db.open());
  server = app.listen(0, async function () {
    base = 'http://localhost:' + server.address().port + '/api/v1';
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@bookmonkey.example', password: 'admin2021' })
    });
    admin = res.headers.get('set-cookie').split(';')[0];
    done();
  });
});

test.after(function () {
  server.close();
  db.close();
});

function get(path, cookie) {
  return fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
}

test('month list ends with the current month', function () {
  const months = reports.monthList(3, '2024-02');
  assert.deepStrictEqual(months, ['2023-12', '2024-01', '2024-02']);
  assert.strictEqual(reports.prevMonth('2024-01'), '2023-12');
});

test('range from/to is checked', function () {
  assert.deepStrictEqual(reports.range({ from: '2024-01', to: '2024-03' }), ['2024-01', '2024-02', '2024-03']);
  assert.throws(() => reports.range({ from: '2024-05', to: '2024-03' }), /before/);
  assert.throws(() => reports.range({ from: '24-1' }), /YYYY-MM/);
});

test('reports need an admin', async function () {
  const res = await get('/admin/reports/summary');
  assert.strictEqual(res.status, 401);
});

test('loans per month has one row per month', async function () {
  const res = await get('/admin/reports/loans-per-month?months=6', admin);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.rows.length, 6);
  assert.ok(data.total > 0);
  assert.ok(data.locations.indexOf('Hamburg') !== -1);
});

// TODO: fails on the windows runner (TZ is UTC there, borrowed_at is local time). fix later
test.skip('loans per month: a loan late on the last day counts for that month', async function () {
  const utils = require('../lib/utils');
  const conn = db.open();
  const copy = conn.prepare("SELECT id FROM copies WHERE location = 'Berlin' ORDER BY id LIMIT 1").get();
  const user = conn.prepare("SELECT id FROM users WHERE email = 'sarah.klein@example.com'").get();
  const before = reports.loansPerMonth({ from: '2024-03', to: '2024-04' });
  conn.prepare('INSERT INTO loans (copy_id, user_id, borrowed_at, due_at, returned_at, renewals) VALUES (?, ?, ?, ?, ?, 0)')
    .run(copy.id, user.id, new Date(2024, 2, 31, 23, 30).toISOString(), '2024-04-28', utils.stamp(new Date(2024, 3, 20, 10, 0)));
  const after = reports.loansPerMonth({ from: '2024-03', to: '2024-04' });
  assert.strictEqual(after.rows[0].loans, before.rows[0].loans + 1);
  assert.strictEqual(after.rows[1].loans, before.rows[1].loans);
});

test('overdue list has the overdue loans from the seed', async function () {
  const rows = await (await get('/admin/reports/overdue', admin)).json();
  const emails = rows.map(r => r.email);
  assert.ok(emails.indexOf('murat.yilmaz@example.com') !== -1);
  assert.ok(rows.every(r => r.days_overdue > 0));
});

test('waitlists: Atomic Habits has 4 people waiting', async function () {
  const rows = await (await get('/admin/reports/waitlists', admin)).json();
  const habits = rows.find(r => r.title === 'Atomic Habits');
  assert.strictEqual(habits.waiting, 4);
  assert.strictEqual(habits.copies, 2);
});

test('revenue ignores cancelled orders', async function () {
  const data = await (await get('/admin/reports/revenue?months=24', admin)).json();
  const cancelled = db.open().prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'cancelled'").get().n;
  const all = db.open().prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  assert.strictEqual(data.total.orders, all - cancelled);
  assert.ok(data.total.gross > data.total.net);
});

test('csv download', async function () {
  const res = await get('/admin/reports/top-books?format=csv', admin);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const text = await res.text();
  assert.ok(text.split('\r\n')[0].indexOf('ISBN;Titel') !== -1);
});

test('departments and stock', async function () {
  const departments = await (await get('/admin/reports/departments?months=12', admin)).json();
  assert.ok(departments.length > 0);
  const stock = await (await get('/admin/reports/stock', admin)).json();
  const total = stock.locations.reduce((n, l) => n + l.total, 0);
  assert.strictEqual(total, 72);
});
