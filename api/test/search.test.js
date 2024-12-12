const test = require('node:test');
const assert = require('node:assert');
const search = require('../services/search');

test('every word becomes one group of LIKEs', function () {
  const w = search.where('dark  lord');
  assert.strictEqual(w.params.length, 2 * search.SEARCH_COLUMNS.length);
  assert.match(w.sql, /\) AND \(/);
  assert.strictEqual(search.where('   '), null);
});

test('snippet marks the hit', function () {
  const text = 'A long time ago the dark lord Sauron made the One Ring to rule them all.';
  const s = search.snippet(text, 'sauron');
  assert.strictEqual(s.text.slice(s.start, s.start + s.length), 'Sauron');
  assert.strictEqual(search.snippet(text, 'potter'), null);
});

test('matchedIn says where the first word was found', function () {
  const row = { title: 'Dune', subtitle: null, author: 'Frank Herbert', abstract: 'Spice and sand.' };
  assert.strictEqual(search.matchedIn(row, 'herbert'), 'author');
  assert.strictEqual(search.matchedIn(row, 'spice'), 'abstract');
  assert.strictEqual(search.matchedIn(row, 'x'), null);
});
