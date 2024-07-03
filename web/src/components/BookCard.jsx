import React from 'react';
import '../styles/book-card.css';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format';
import { listPrice, listPriceRegular } from '../utils/price';
import { t } from '../i18n';

// card in the catalogue grid (function component since 2024, was a class)
export default function BookCard({ book }) {
  const price = listPrice(book);
  return (
    <div className="book-card">
      <Link to={'/books/' + book.isbn} className="book-card__link">
        <img className="book-card__cover" src={book.cover} alt="" loading="lazy" />
        <div className="book-card__body">
          <div className="book-card__title">{book.title}</div>
          <div className="book-card__author">{book.author}</div>
        </div>
      </Link>
      <div className="book-card__footer">
        <span className="book-card__price">
          {price === null ? (
            <span className="price price--none">{t('price.onRequest')}</span>
          ) : (
            <span className={book.discount ? 'price price--discount' : 'price'}>
              {book.discount && <del className="price__regular">{formatPrice(listPriceRegular(book), book.currency)}</del>}
              {formatPrice(price, book.currency)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
