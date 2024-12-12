// Merkliste
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
const app = require('../server');

let server;
let base;
let lea;

test.before(function (t, done) {
  seed.run(db.open());
  server = app.listen(0, async function () {
    base = 'http://localhost:' + server.address().port + '/api/v1';
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lea.hoffmann@example.com', password: 'buecher' })
    });
    lea = res.headers.get('set-cookie').split(';')[0];
    done();
  });
});

test.after(function () {
  server.close();
  db.close();
});

function call(method, path, body) {
  return fetch(base + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', Cookie: lea },
    body: body ? JSON.stringify(body) : undefined
  });
}

test('list from the seed', async function () {
  const items = await (await call('GET', '/wishlist')).json();
  assert.strictEqual(items.length, 2);
  assert.ok(items.every(i => i.action === 'borrow'));
});

test('add a book that is out and reserve it from the list', async function () {
  let res = await call('POST', '/wishlist', { isbn: '978-0-7352-1129-2', note: 'für den Urlaub' });
  assert.strictEqual(res.status, 201);
  const item = await res.json();
  assert.strictEqual(item.note, 'für den Urlaub');

  res = await call('POST', '/wishlist', { isbn: '978-0-7352-1129-2' });
  assert.strictEqual(res.status, 409);

  // lea is on the waitlist already (seed)
  res = await call('POST', '/wishlist/978-0-7352-1129-2/reserve', {});
  assert.strictEqual(res.status, 409);
});

test('a book with a copy on the shelf cannot be reserved', async function () {
  const res = await call('POST', '/wishlist/978-0-441-17269-6/reserve', {});
  assert.strictEqual(res.status, 409);
  const items = await (await call('GET', '/wishlist')).json();
  assert.ok(items.some(i => i.isbn === '978-0-441-17269-6'));
});

test('remove', async function () {
  let res = await call('DELETE', '/wishlist/978-0-441-17269-6');
  assert.strictEqual(res.status, 204);
  res = await call('DELETE', '/wishlist/978-0-441-17269-6');
  assert.strictEqual(res.status, 404);
});
