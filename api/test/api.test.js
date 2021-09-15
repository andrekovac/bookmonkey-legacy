// starts the app on a random port with an in-memory db
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
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

test('lists books', async function () {
  const res = await fetch(base + '/books?_limit=5');
  assert.strictEqual(res.status, 200);
  const books = await res.json();
  assert.strictEqual(books.length, 5);
  assert.ok(books[0].title);
});

test('search by title', async function () {
  const res = await fetch(base + '/books?q=potter&_limit=50');
  const books = await res.json();
  assert.strictEqual(books.length, 7);
});

test('book detail and series', async function () {
  const res = await fetch(base + '/books/978-0-7475-3269-9');
  const book = await res.json();
  assert.strictEqual(book.title, 'Harry Potter and the Philosopher’s Stone');
  assert.strictEqual(book.successorIsbn, '978-0-7475-3849-3');

  const next = await fetch(base + '/books/' + book.successorIsbn);
  assert.strictEqual(next.status, 200);

  const series = await (await fetch(base + '/books/978-0-7475-3849-3/series')).json();
  assert.strictEqual(series.total, 7);
  assert.strictEqual(series.position, 2);
});

test('login', async function () {
  const res = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mia.schulz@example.com', password: 'lesen123' })
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('set-cookie').indexOf('bm_session=') === 0);
});

test('admin routes need admin', async function () {
  const res = await fetch(base + '/users');
  assert.strictEqual(res.status, 401);
});
