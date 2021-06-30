const test = require('node:test');
const assert = require('node:assert');
const pricing = require('../lib/pricing');
const money = require('../lib/money');

test('adds 7% vat', function () {
  assert.strictEqual(pricing.gross(10), 10.7);
  assert.strictEqual(pricing.gross(12.99), 13.9);
  assert.strictEqual(pricing.gross(15.99), 17.11);
});

test('gross of nothing is null', function () {
  assert.strictEqual(pricing.gross(null), null);
  assert.strictEqual(pricing.gross(''), null);
});

test('line total', function () {
  assert.strictEqual(pricing.lineGross(12.99, 3), 41.7);
});

test('money parse', function () {
  assert.strictEqual(money.parse('12,99'), 12.99);
  assert.strictEqual(money.parse('12.99 €'), 12.99);
});
