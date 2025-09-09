// Änderungsprotokoll. Same setup as api.test.js
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
const app = require('../server');
const audit = require('../lib/audit');

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
      body: JSON.stringify({ email: 'bibliothek@bookmonkey.example', password: 'regal2022' })
    });
    admin = res.headers.get('set-cookie').split(';')[0];
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
    headers: { 'Content-Type': 'application/json', Cookie: admin },
    body: body ? JSON.stringify(body) : undefined
  });
}

test('diff only lists changed keys', function () {
  assert.deepStrictEqual(audit.diff({ a: 1, b: 2, c: null }, { a: 1, b: 3 }, ['a', 'b', 'c']), { b: [2, 3] });
});

test('changing a copy and a discount shows up in the protocol', async function () {
  const copies = await (await call('GET', '/admin/copies?q=BM-00001')).json();
  let res = await call('PUT', '/admin/copies/' + copies[0].id, { shelf: 'R7' });
  assert.strictEqual(res.status, 200);
  res = await call('POST', '/admin/discounts', { name: 'Herbst', scope: 'all', percent: 5 });
  assert.strictEqual(res.status, 201);

  const rows = await (await call('GET', '/admin/audit')).json();
  assert.strictEqual(rows[0].entity, 'discount');
  assert.strictEqual(rows[0].action, 'create');
  assert.strictEqual(rows[0].email, 'bibliothek@bookmonkey.example');
  assert.strictEqual(rows[1].entity, 'copy');
  assert.strictEqual(rows[1].entity_id, 'BM-00001');
  assert.deepStrictEqual(rows[1].details.shelf[1], 'R7');

  const onlyCopies = await (await call('GET', '/admin/audit?entity=copy')).json();
  assert.strictEqual(onlyCopies.length, 1);
  assert.strictEqual((await call('GET', '/admin/audit?entity=nope')).status, 400);
});

test('protocol is for admins only', async function () {
  const res = await fetch(base + '/admin/audit');
  assert.strictEqual(res.status, 401);
});
