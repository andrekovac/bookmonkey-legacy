// money helpers, amounts are euros as numbers (12.99)

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

// "12,99" or "12.99" -> 12.99
function parse(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return NaN;
  return parseFloat(String(value).replace(/\s/g, '').replace('€', '').replace(',', '.'));
}

function format(value, currency) {
  if (value === null || value === undefined || isNaN(value)) return '';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(value);
}

module.exports = { round, parse, format };
