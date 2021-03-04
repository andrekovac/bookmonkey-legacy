// Deletes the local database and creates a fresh one with seed data.
// usage: npm run db:reset
const fs = require('fs');
const db = require('../db');
const seed = require('../seed/seed');

if (db.DB_FILE !== ':memory:') {
  ['', '-journal', '-wal', '-shm'].forEach(function (suffix) {
    const f = db.DB_FILE + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

const conn = db.open();
seed.run(conn);
db.close();
console.log('database ready: ' + db.DB_FILE);
