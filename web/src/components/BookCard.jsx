import React from 'react';
import '../styles/book-card.css';
import { Link } from 'react-router-dom';

class BookCard extends React.Component {
  render() {
    const book = this.props.book;
    return (
      <div className="book-card">
        <Link to={'/books/' + book.isbn} className="book-card__link">
          <img className="book-card__cover" src={book.cover} alt={book.title} loading="lazy" />
          <div className="book-card__body">
            <div className="book-card__title">{book.title}</div>
            <div className="book-card__author">{book.author}</div>
          </div>
        </Link>
        <div className="book-card__footer">
          <span className="book-card__price">{book.price} {book.currency}</span>
        </div>
      </div>
    );
  }
}

export default BookCard;
