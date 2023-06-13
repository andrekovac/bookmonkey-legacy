// ISBN helpers.
//
// We show ISBNs the way they are printed on the book (978-0-7475-3269-9), so
// the importer and the admin store them in that format. Hyphen positions depend
// on the registration group and the publisher range, see
// https://www.isbn-international.org/range_file_for_isbn_13 (only the groups we
// actually sell are in here, everything else falls back to 978-X-XXXXXXXX-X).

// publisher ranges for the english language groups 0 and 1
// [from, to, length of publisher part]
const RANGES = {
  '0': [
    ['00', '19', 2],
    ['200', '699', 3],
    ['7000', '8499', 4],
    ['85000', '89999', 5],
    ['900000', '949999', 6],
    ['9500000', '9999999', 7]
  ],
  '1': [
    ['00', '09', 2],
    ['100', '399', 3],
    ['4000', '5499', 4],
    ['55000', '86979', 5],
    ['869800', '998999', 6],
    ['9990000', '9999999', 7]
  ],
  // german speaking countries
  '3': [
    ['00', '02', 2],
    ['030', '033', 3],
    ['0340', '0369', 4],
    ['03700', '03999', 5],
    ['04', '19', 2],
    ['200', '699', 3],
    ['7000', '8499', 4],
    ['85000', '89999', 5],
    ['900000', '949999', 6],
    ['9500000', '9539999', 7]
  ]
};

function digitsOnly(value) {
  return String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

function checkDigit13(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(first12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const rest = sum % 10;
  return rest === 0 ? '0' : String(10 - rest);
}

function isValid(value) {
  const d = digitsOnly(value);
  if (d.length !== 13) return false;
  if (!/^97[89]/.test(d)) return false;
  return checkDigit13(d.slice(0, 12)) === d[12];
}

// old ISBN-10 from the supplier lists -> ISBN-13
function from10(value) {
  const d = digitsOnly(value);
  if (d.length !== 10) return null;
  const first12 = '978' + d.slice(0, 9);
  return first12 + checkDigit13(first12);
}

function publisherLength(group, rest) {
  const ranges = RANGES[group];
  if (!ranges) return null;
  for (let i = 0; i < ranges.length; i++) {
    const from = ranges[i][0];
    const to = ranges[i][1];
    const prefix = rest.slice(0, from.length);
    if (prefix >= from && prefix <= to) return ranges[i][2];
  }
  return null;
}

// 9780747532699 -> 978-0-7475-3269-9
function format(value) {
  let d = digitsOnly(value);
  if (d.length === 10) d = from10(d);
  if (!d || d.length !== 13) return String(value || '').trim();

  const prefix = d.slice(0, 3);
  const group = d.slice(3, 4);
  const rest = d.slice(4, 12);
  const check = d.slice(12);
  const len = publisherLength(group, rest);
  if (!len) {
    return [prefix, group, rest, check].join('-');
  }
  return [prefix, group, rest.slice(0, len), rest.slice(len), check].join('-');
}

// Form we store from now on: no hyphens, no spaces (9780747532699).
// Shorter keys for the unique index, and the mobile app and the scanners send plain isbns anyway.
// Use format() for display.
function normalizeIsbn(value) {
  return String(value || '').replace(/[\s-]/g, '').toUpperCase();
}

module.exports = {
  normalizeIsbn,
  digitsOnly,
  isValid,
  from10,
  format,
  checkDigit13
};
