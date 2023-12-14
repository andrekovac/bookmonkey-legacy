// /api/v2 (TypeScript, see src/v2)
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
    base = 'http://localhost:' + server.address().port + '/api/v2';
    done();
  });
});

test.after(function () {
  server.close();
  db.close();
});

async function get(path) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json(), res: res };
}

test('list has paging info', async function () {
  const { status, body } = await get('/books?limit=5&page=2');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.items.length, 5);
  assert.strictEqual(body.page, 2);
  assert.strictEqual(body.total, 50);
  assert.strictEqual(body.pages, 10);
  assert.strictEqual(typeof body.items[0].price.gross, 'number');
});

test('list validates the query', async function () {
  const { status, body } = await get('/books?limit=1000&sort=isbn');
  assert.strictEqual(status, 400);
  const paths = body.errors.map(e => e.path).sort();
  assert.deepStrictEqual(paths, ['query.limit', 'query.sort']);
});

test('detail with plain isbn, isbn-10 and hyphens', async function () {
  for (const isbn of ['9780547928210', '0547928211', '978-0-547-92821-0']) {
    const { status, body } = await get('/books/' + isbn);
    assert.strictEqual(status, 200, isbn);
    assert.strictEqual(body.title, 'The Fellowship of the Ring');
    assert.strictEqual(body.links.successor, '/api/v2/books/978-0-547-92820-3');
  }
});

test('detail says what is wrong with an isbn', async function () {
  const { status, body } = await get('/books/9780547928211');
  assert.strictEqual(status, 400);
  assert.strictEqual(body.errors[0].message, 'wrong check digit (ISBN-13)');
  const missing = await get('/books/9783161484100');
  assert.strictEqual(missing.status, 404);
});

test('search', async function () {
  const { status, body } = await get('/books/search?q=ring%20tolkien');
  assert.strictEqual(status, 200);
  assert.ok(body.total >= 1);
  assert.ok(body.items[0].title.indexOf('Ring') !== -1);
  const short = await get('/books/search?q=a');
  assert.strictEqual(short.status, 400);
});

test('openapi document', async function () {
  const { status, body } = await get('/openapi.json');
  assert.strictEqual(status, 200);
  assert.ok(body.paths['/books/{isbn}']);
});

test('unknown v2 route has the v2 error shape', async function () {
  const { status, body } = await get('/loans');
  assert.strictEqual(status, 404);
  assert.ok(Array.isArray(body.errors));
});

test('v2 loans: toIso keeps ISO and converts old local stamps', function () {
  const { toIso } = require('../src/v2/loans.ts');
  assert.strictEqual(toIso('2023-11-08T08:15:00.000Z'), '2023-11-08T08:15:00.000Z');
  assert.strictEqual(toIso('2023-11-08 09:15:00'), new Date('2023-11-08T09:15:00').toISOString());
  assert.strictEqual(toIso(null), null);
});
