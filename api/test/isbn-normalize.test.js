const test = require('node:test');
const assert = require('node:assert');
const isbn = require('../lib/isbn');

test('normalizeIsbn strips hyphens and spaces', function () {
  assert.strictEqual(isbn.normalizeIsbn('978-0-7475-3269-9'), '9780747532699');
  assert.strictEqual(isbn.normalizeIsbn(' 978 0 7475 3269 9 '), '9780747532699');
  assert.strictEqual(isbn.normalizeIsbn('9780747532699'), '9780747532699');
  assert.strictEqual(isbn.normalizeIsbn('0-8044-2957-x'), '080442957X');
  assert.strictEqual(isbn.normalizeIsbn(null), '');
});

test('format still gives the printed form', function () {
  assert.strictEqual(isbn.format(isbn.normalizeIsbn('978-0-7475-3269-9')), '978-0-7475-3269-9');
});
