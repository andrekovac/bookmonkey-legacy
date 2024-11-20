// Deletes the local database and creates a fresh one with seed data.
// usage: npm run db:reset
const fs = require('fs');
const db = require('../db');
const seed = require('../seed/seed');
const fixes2024 = require('../seed/fixes-2024');

if (db.DB_FILE !== ':memory:') {
  ['', '-journal', '-wal', '-shm'].forEach(function (suffix) {
    const f = db.DB_FILE + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

const conn = db.open();
seed.run(conn);
// corrections from 2024, so a fresh database looks like the live one
fixes2024.run(conn);
db.close();
console.log('database ready: ' + db.DB_FILE);
