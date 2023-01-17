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

test('discounted net is rounded to cents', function () {
  assert.strictEqual(pricing.discountedNet(14.99, 0.1), 13.49);
  assert.strictEqual(pricing.discountedNet(14.99, 0), 14.99);
});

test('best discount rule wins', function () {
  const rules = [
    { scope: 'all', value: null, percent: 5 },
    { scope: 'publisher', value: 'Tor Books', percent: 10 },
    { scope: 'author', value: 'Robert Jordan', percent: 15 }
  ];
  assert.strictEqual(pricing.discountFor({ publisher: 'Tor Books', author: 'Brandon Sanderson' }, rules), 0.1);
  assert.strictEqual(pricing.discountFor({ publisher: 'Tor Books', author: 'Robert Jordan' }, rules), 0.15);
  assert.strictEqual(pricing.discountFor({ publisher: 'Bloomsbury' }, rules), 0.05);
});
