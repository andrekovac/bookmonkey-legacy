// CSV for Excel (German): ";" as separator, UTF-8 with BOM so umlauts work when opened by
// double click. Used by the admin exports and the reports.
//
//   csv.write(rows, [{ key: 'isbn', label: 'ISBN' }, { key: r => r.a + r.b, label: 'Sum' }])
const SEPARATOR = ';';
const BOM = '﻿';

function cell(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (s.indexOf(SEPARATOR) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function valueOf(row, column) {
  return typeof column.key === 'function' ? column.key(row) : row[column.key];
}

// columns: [{ key, label }] or a list of keys
function write(rows, columns) {
  const cols = (columns || Object.keys(rows[0] || {})).map(c => (typeof c === 'string' ? { key: c, label: c } : c));
  const lines = [cols.map(c => cell(c.label || c.key)).join(SEPARATOR)];
  (rows || []).forEach(function (row) {
    lines.push(cols.map(c => cell(valueOf(row, c))).join(SEPARATOR));
  });
  return BOM + lines.join('\r\n') + '\r\n';
}

// express helper
function send(res, filename, rows, columns) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.send(write(rows, columns));
}

module.exports = { write, send, cell, SEPARATOR };
