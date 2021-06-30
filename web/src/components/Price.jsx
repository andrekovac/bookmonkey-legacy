import React from 'react';
import { formatPrice } from '../utils/format';

// gross price as shown to customers
class Price extends React.Component {
  render() {
    const { book, showVat } = this.props;
    if (book.priceGross === null || book.priceGross === undefined) {
      return <span className="price price--none">Preis auf Anfrage</span>;
    }
    return (
      <span className="price">
        {formatPrice(book.priceGross, book.currency)}
        {showVat && <small className="price__vat"> inkl. 7 % MwSt.</small>}
      </span>
    );
  }
}

export default Price;
