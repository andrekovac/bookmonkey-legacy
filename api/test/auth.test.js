// login with old (md5) and new (bcrypt) password hashes
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
const auth = require('../lib/auth');
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

function post(path, body, cookie) {
  return fetch(base + path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body)
  });
}

test('checkPassword knows both hash types', function () {
  assert.ok(auth.checkPassword('geheim', auth.hashPassword('geheim')));
  assert.ok(auth.checkPassword('geheim', auth.legacyHash('geheim')));
  assert.ok(!auth.checkPassword('falsch', auth.hashPassword('geheim')));
  assert.ok(!auth.checkPassword('falsch', auth.legacyHash('geheim')));
  assert.ok(auth.isLegacyHash(auth.legacyHash('x')));
  assert.ok(!auth.isLegacyHash(auth.hashPassword('x')));
});

test('login with a bcrypt account', async function () {
  const res = await post('/auth/login', { email: 'nina.vogel@example.com', password: 'vogel2023' });
  assert.strictEqual(res.status, 200);
  const wrong = await post('/auth/login', { email: 'nina.vogel@example.com', password: 'vogel2022' });
  assert.strictEqual(wrong.status, 401);
});

test('register stores a bcrypt hash', async function () {
  const res = await post('/auth/register', { email: 'neu@example.com', password: 'neu12345', name: 'Neu' });
  assert.strictEqual(res.status, 201);
  const row = auth.findUserByEmail('neu@example.com');
  assert.ok(row.password.indexOf('$2') === 0);
});

test('password change moves an md5 account to bcrypt', async function () {
  const login = await post('/auth/login', { email: 'jonas.becker@example.com', password: 'jonas2021' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.ok(auth.isLegacyHash(auth.findUserByEmail('jonas.becker@example.com').password));
  const res = await fetch(base + '/auth/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ currentPassword: 'jonas2021', password: 'jonas2023' })
  });
  assert.strictEqual(res.status, 200);
  assert.ok(!auth.isLegacyHash(auth.findUserByEmail('jonas.becker@example.com').password));
  const again = await post('/auth/login', { email: 'jonas.becker@example.com', password: 'jonas2023' });
  assert.strictEqual(again.status, 200);
});

test('data export has my loans and no password hash', async function () {
  const res = await post('/auth/login', { email: 'mia.schulz@example.com', password: 'lesen123' });
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const exp = await fetch(base + '/auth/me/export', { headers: { Cookie: cookie } });
  assert.strictEqual(exp.status, 200);
  assert.ok(exp.headers.get('content-disposition').indexOf('meine-daten') !== -1);
  const data = await exp.json();
  assert.strictEqual(data.profile.email, 'mia.schulz@example.com');
  assert.strictEqual(data.profile.passwordType, 'md5');
  assert.strictEqual(data.profile.password, undefined);
  assert.ok(data.loans.length >= 1);
  assert.ok(Array.isArray(data.orders));
  assert.strictEqual(JSON.stringify(data).indexOf(auth.legacyHash('lesen123')), -1);

  const anonymous = await fetch(base + '/auth/me/export');
  assert.strictEqual(anonymous.status, 401);
});
