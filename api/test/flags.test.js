process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const flags = require('../lib/flags');

test.before(function () {
  db.open();
});

test.after(function () {
  db.close();
});

test('unknown flags are off, known flags have their default', function () {
  assert.strictEqual(flags.isEnabled('NOT_A_FLAG'), false);
  assert.strictEqual(flags.isEnabled('ENABLE_REPORTS'), flags.DEFAULTS.ENABLE_REPORTS.enabled);
});

test('a row in feature_flags overrides the default', function () {
  const f = flags.set('ENABLE_REPORTS', true, null);
  assert.strictEqual(f.enabled, true);
  assert.strictEqual(f.source, 'db');
  assert.strictEqual(flags.isEnabled('ENABLE_REPORTS'), true);
  flags.set('ENABLE_REPORTS', false, null);
  assert.strictEqual(flags.isEnabled('ENABLE_REPORTS'), false);
});

test('env wins over the database', function () {
  process.env.FLAG_ENABLE_REPORTS = 'on';
  try {
    assert.strictEqual(flags.describe('ENABLE_REPORTS').source, 'env');
    assert.strictEqual(flags.isEnabled('ENABLE_REPORTS'), true);
  } finally {
    delete process.env.FLAG_ENABLE_REPORTS;
  }
});

test('set() refuses unknown flags', function () {
  assert.throws(() => flags.set('ENABLE_EVERYTHING', true), /unknown flag/);
});
