// Prices in the DB are net prices in EUR. Books have the reduced VAT rate.
const money = require('./money');

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

module.exports = {
  VAT_BOOKS,
  gross,
  vatOf,
  lineGross
};
