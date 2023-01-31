// Inventur (once a year, December). The team scans every barcode on the shelves of one
// location, then we compare with what the database thinks is there.
const db = require('../db');
const utils = require('../lib/utils');
const waitlist = require('./waitlist');

function clean(barcodes) {
  const seen = {};
  const out = [];
  (barcodes || []).forEach(function (b) {
    const code = String(b || '').trim().toUpperCase();
    if (!code || seen[code]) return;
    seen[code] = true;
    out.push(code);
  });
  return out;
}

const COPY_SELECT = 'SELECT c.*, b.isbn, b.title FROM copies c JOIN books b ON b.id = c.book_id';

// result lists:
//   found     on the shelf and in the db, all good
//   missing   should be on the shelf (available / repair) but was not scanned
//   unknown   barcode is not in the db at all (old label?)
//   elsewhere belongs to another location
//   onLoan    scanned, but the db says it is on loan -> return was not booked
//   lost      scanned, but marked as lost -> found again
function compare(location, barcodes) {
  const conn = db.open();
  const scanned = clean(barcodes);
  const byCode = conn.prepare(COPY_SELECT + ' WHERE c.barcode = ?');
  const result = { location: location, scanned: scanned.length, found: [], missing: [], unknown: [], elsewhere: [], onLoan: [], lost: [] };

  scanned.forEach(function (code) {
    const copy = byCode.get(code);
    if (!copy) return result.unknown.push(code);
    if (copy.location !== location) return result.elsewhere.push(copy);
    if (copy.status === 'on_loan') return result.onLoan.push(copy);
    if (copy.status === 'lost') return result.lost.push(copy);
    result.found.push(copy);
  });

  const expected = conn.prepare(COPY_SELECT + " WHERE c.location = ? AND c.status IN ('available', 'repair', 'on_hold') ORDER BY c.barcode").all(location);
  expected.forEach(function (copy) {
    if (scanned.indexOf(copy.barcode) === -1) result.missing.push(copy);
  });
  return result;
}

// Achtung: changes data. missing -> lost, lost but scanned -> available (or hold shelf)
function apply(location, barcodes) {
  const result = compare(location, barcodes);
  const conn = db.open();
  const note = 'Inventur ' + utils.today();
  const markLost = conn.prepare("UPDATE copies SET status = 'lost', note = ?, updated_at = ? WHERE id = ?");

  conn.exec('BEGIN');
  try {
    result.missing.forEach(function (copy) {
      // on_hold copies are on the hold shelf, not in the normal shelf -> skip
      if (copy.status === 'on_hold') return;
      markLost.run(note + ': nicht gefunden', utils.now(), copy.id);
    });
    result.lost.forEach(function (copy) {
      conn.prepare('UPDATE copies SET note = ?, updated_at = ? WHERE id = ?').run(note + ': wieder gefunden', utils.now(), copy.id);
      waitlist.copyReturned(copy);
    });
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
  result.applied = true;
  return result;
}

module.exports = { clean, compare, apply };
