// Input checks shared by the importers (2022). Return a list of error strings, empty = ok.
// TODO: use this in routes.js too
const isbn = require('./isbn');
const money = require('./money');

// supplier titles are sometimes longer (series name in the title), so 120 here
const TITLE_MAX = 120;

function title(value) {
  if (value === null || value === undefined || !String(value).trim()) return ['title is required'];
  if (String(value).length > TITLE_MAX) return ['title is too long (max ' + TITLE_MAX + ')'];
  return [];
}

function isbnValue(value) {
  return isbn.isValid(value) ? [] : ['isbn is not valid'];
}

function price(value) {
  if (value === null || value === undefined || value === '') return [];
  const n = money.parse(value);
  return isNaN(n) || n < 0 ? ['price must be a positive number'] : [];
}

function pages(value) {
  if (value === null || value === undefined || value === '') return [];
  return isNaN(parseInt(value, 10)) ? ['pages must be a number'] : [];
}

// YYYY-MM-DD or YYYY
function date(value) {
  if (!value) return [];
  return /^\d{4}(-\d{2}-\d{2})?$/.test(String(value)) ? [] : ['date must be YYYY-MM-DD'];
}

function email(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()) ? [] : ['email is not valid'];
}

// record in db column names (snake_case), like the csv importer builds it
function bookRecord(rec) {
  return []
    .concat(isbnValue(rec.isbn))
    .concat(title(rec.title))
    .concat(price(rec.price))
    .concat(pages(rec.num_pages))
    .concat(date(rec.published_at));
}

module.exports = { TITLE_MAX, title, isbn: isbnValue, price, pages, date, email, bookRecord };
