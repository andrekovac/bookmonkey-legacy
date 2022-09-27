import React from 'react';
import { formatPrice } from '../utils/format';

// gross price as shown to customers. With a discount rule: old price crossed out
class Price extends React.Component {
  render() {
    const { book, showVat } = this.props;
    if (book.priceGross === null || book.priceGross === undefined) {
      return <span className="price price--none">Preis auf Anfrage</span>;
    }
    return (
      <span className={book.discount ? 'price price--discount' : 'price'}>
        {book.discount && (
          <del className="price__regular">{formatPrice(book.priceGrossRegular, book.currency)}</del>
        )}
        {formatPrice(book.priceGross, book.currency)}
        {book.discount && showVat && (
          <span className="price__badge">-{Math.round(book.discount * 100)} % {book.discountName}</span>
        )}
        {showVat && <small className="price__vat"> inkl. 7 % MwSt.</small>}
      </span>
    );
  }
}

export default Price;
