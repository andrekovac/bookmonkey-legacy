// gross price for lists (catalogue cards). Same formula as the CSV export
// (api/services/export.js), with 2 decimals. The detail page shows priceGross from the API.
export function listPrice(book) {
  if (!book || book.price === null || book.price === undefined) return null;
  return (book.price * (1 - (book.discount || 0)) * 1.07).toFixed(2);
}

export function listPriceRegular(book) {
  if (!book || book.price === null || book.price === undefined) return null;
  return (book.price * 1.07).toFixed(2);
}
