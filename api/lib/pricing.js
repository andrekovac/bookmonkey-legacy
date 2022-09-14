// Prices in the DB are net prices in EUR. Books have the reduced VAT rate.
const money = require('./money');
const db = require('../db');
const utils = require('./utils');

const VAT_BOOKS = 0.07;

function gross(net, vat) {
  if (net === null || net === undefined || net === '') return null;
  const rate = vat === undefined ? VAT_BOOKS : vat;
  return money.round(Number(net) * (1 + rate));
}

function vatOf(net, vat) {
  const g = gross(net, vat);
  if (g === null) return null;
  return money.round(g - Number(net));
}

// price for qty pieces of one book, gross
function lineGross(net, qty) {
  return money.round(gross(net) * (qty || 1));
}

// ---------------------------------------------------------------------------
// Rabatte (2022). Rules are managed in the admin, see migrations/009_discount_rules.sql

function activeRules() {
  const today = utils.today();
  return db.open().prepare(`SELECT * FROM discount_rules
    WHERE active = 1
      AND (valid_from IS NULL OR valid_from <= ?)
      AND (valid_until IS NULL OR valid_until >= ?)`).all(today, today);
}

function ruleMatches(rule, book) {
  switch (rule.scope) {
    case 'all':
      return true;
    case 'publisher':
      return !!book.publisher && book.publisher === rule.value;
    case 'author':
      return !!book.author && book.author === rule.value;
    case 'isbn':
      return !!book.isbn && book.isbn.replace(/-/g, '') === String(rule.value || '').replace(/-/g, '');
    default:
      return false;
  }
}

// book = db row. Returns the best matching rule or null
function bestRule(book, rules) {
  let best = null;
  (rules || activeRules()).forEach(function (rule) {
    if (!ruleMatches(rule, book)) return;
    if (!best || rule.percent > best.percent) best = rule;
  });
  return best;
}

// 0.1 for 10 %, 0 when there is no discount
function discountFor(book, rules) {
  const rule = bestRule(book, rules);
  return rule ? rule.percent / 100 : 0;
}

// discounted net, rounded to cents (the shop system did it the same way)
function discountedNet(net, discount) {
  if (net === null || net === undefined || net === '') return null;
  if (!discount) return Number(net);
  return money.round(Number(net) * (1 - discount));
}

// everything the frontend needs for one book
function forBook(book, rules) {
  const rule = bestRule(book, rules);
  const discount = rule ? rule.percent / 100 : 0;
  const net = discountedNet(book.price, discount);
  return {
    discount: discount || null,
    discountName: rule ? rule.name : null,
    net: net,
    gross: gross(net),
    grossRegular: gross(book.price)
  };
}

module.exports = {
  VAT_BOOKS,
  gross,
  vatOf,
  lineGross,
  activeRules,
  ruleMatches,
  bestRule,
  discountFor,
  discountedNet,
  forBook
};
