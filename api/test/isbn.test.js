const test = require('node:test');
const assert = require('node:assert');
const isbn = require('../lib/isbn');

test('formats isbn-13 with hyphens', function () {
  assert.strictEqual(isbn.format('9780747532699'), '978-0-7475-3269-9');
  assert.strictEqual(isbn.format('9780553588484'), '978-0-553-58848-4');
  assert.strictEqual(isbn.format('9781338635171'), '978-1-338-63517-1');
  assert.strictEqual(isbn.format('9780060850524'), '978-0-06-085052-4');
});

test('keeps already formatted values', function () {
  assert.strictEqual(isbn.format('978-0-7475-3269-9'), '978-0-7475-3269-9');
  assert.strictEqual(isbn.format(' 978 0 7475 3269 9 '), '978-0-7475-3269-9');
});

test('converts isbn-10', function () {
  assert.strictEqual(isbn.from10('0747532699'), '9780747532699');
  assert.strictEqual(isbn.format('0-7475-3269-9'), '978-0-7475-3269-9');
});

test('validates check digit', function () {
  assert.ok(isbn.isValid('978-0-7475-3269-9'));
  assert.ok(!isbn.isValid('978-0-7475-3269-8'));
  assert.ok(!isbn.isValid('12345'));
});

test('isbn-10 for display', function () {
  assert.strictEqual(isbn.to10('9780747532699'), '0747532699');
  assert.strictEqual(isbn.format10('978-0-7475-3269-9'), '0-7475-3269-9');
  assert.strictEqual(isbn.format10('9780553588484'), '0-553-58848-6');
  assert.strictEqual(isbn.to10('9780804429573'), '080442957X');
  assert.strictEqual(isbn.format10('9791032305690'), null);
});

test('lookupForms only for isbns', function () {
  assert.deepStrictEqual(isbn.lookupForms('0-7475-3269-9'), ['978-0-7475-3269-9', '9780747532699']);
  assert.deepStrictEqual(isbn.lookupForms(' 9780747532699 '), ['978-0-7475-3269-9', '9780747532699']);
  assert.strictEqual(isbn.lookupForms('potter'), null);
  assert.strictEqual(isbn.lookupForms('1984'), null);
});
