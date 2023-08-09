// Vormerkung per Mail-Link
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
const links = require('../services/reservation-links');
const waitlist = require('../services/waitlist');
const app = require('../server');

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

function sarahsReservation() {
  return db.open().prepare(`SELECT r.* FROM reservations r JOIN users u ON u.id = r.user_id
    WHERE u.email = 'sarah.klein@example.com'`).get();
}

test('decline link cancels the reservation without login', async function () {
  const r = sarahsReservation();
  const token = links.declineToken(r);
  const info = await (await fetch(base + '/reservations/link/' + token)).json();
  assert.strictEqual(info.action, 'decline');
  assert.strictEqual(info.book.title, 'Atomic Habits');
  assert.strictEqual(info.possible, true);

  const res = await fetch(base + '/reservations/link/' + token, { method: 'POST' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).reservation.status, 'cancelled');

  const again = await (await fetch(base + '/reservations/link/' + token)).json();
  assert.strictEqual(again.possible, false);
});

test('reserve link puts the person back on the waitlist', async function () {
  const r = sarahsReservation();
  const res = await fetch(base + '/reservations/link/' + links.reserveToken(r), { method: 'POST' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.reservation.status, 'waiting');
  assert.strictEqual(body.reservation.source, 'mail');
  assert.ok(waitlist.queue(r.book_id).some(x => x.id === body.reservation.id));
});

test('changed token is rejected', async function () {
  const token = links.declineToken(sarahsReservation());
  const res = await fetch(base + '/reservations/link/' + token.slice(0, -3) + 'abc');
  assert.strictEqual(res.status, 410);
  assert.ok((await res.json()).message);
});
