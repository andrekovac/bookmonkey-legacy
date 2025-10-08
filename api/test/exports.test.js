// Export v2 (reviews, loans). Same setup as api.test.js
process.env.BM_DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../db');
const seed = require('../seed/seed');
const app = require('../server');

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
      body: JSON.stringify({ email: 'admin@bookmonkey.example', password: 'admin2021' })
    });
    admin = res.headers.get('set-cookie').split(';')[0];
    done();
  });
});

test.after(function () {
  server.close();
  db.close();
});

async function csvLines(path) {
  const res = await fetch(base + path, { headers: { Cookie: admin } });
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('content-type').indexOf('text/csv') === 0);
  return (await res.text()).replace(/^﻿/, '').trim().split('\r\n');
}

test('reviews as csv', async function () {
  const lines = await csvLines('/admin/export/reviews.csv');
  assert.strictEqual(lines[0], 'Datum;ISBN;Titel;Autor;Sterne;Name;E-Mail;Standort;Abteilung;Text');
  assert.strictEqual(lines.length, 1 + 7);
});

test('only bad reviews', async function () {
  const lines = await csvLines('/admin/export/reviews.csv?max=2');
  lines.slice(1).forEach(l => assert.ok(Number(l.split(';')[4]) <= 2));
});

test('loans as csv, with a time range', async function () {
  const all = await csvLines('/admin/export/loans.csv');
  assert.strictEqual(all.length, 1 + 139);
  assert.ok(all[0].indexOf('Exemplar') !== -1);
  const open = await csvLines('/admin/export/loans.csv?open=1');
  assert.strictEqual(open.length, 1 + 5);
});

test('wrong date', async function () {
  const res = await fetch(base + '/admin/export/loans.csv?from=1.1.2025', { headers: { Cookie: admin } });
  assert.strictEqual(res.status, 400);
});
