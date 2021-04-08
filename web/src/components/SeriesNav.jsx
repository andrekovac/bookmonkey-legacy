import React from 'react';
import { Link } from 'react-router-dom';
import xhr from '../api/xhr';

// Shows "previous / next volume" for a book that is part of a series.
class SeriesNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = { prev: null, next: null, series: null };
  }

  componentDidMount() {
    this.load();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.book.isbn !== this.props.book.isbn) this.load();
  }

  loadNeighbour(isbn, key) {
    if (!isbn) {
      this.setState({ [key]: null });
      return;
    }
    this.setState({ [key]: { isbn: isbn, loading: true } });
    xhr.get('/books/' + encodeURIComponent(isbn), (err, book) => {
      if (err) {
        this.setState({ [key]: { isbn: isbn, missing: true } });
        return;
      }
      this.setState({ [key]: { isbn: book.isbn, title: book.title } });
    });
  }

  load() {
    const book = this.props.book;
    this.loadNeighbour(book.predecessorIsbn, 'prev');
    this.loadNeighbour(book.successorIsbn, 'next');
    if (book.predecessorIsbn || book.successorIsbn) {
      xhr.get('/books/' + encodeURIComponent(book.isbn) + '/series', (err, series) => {
        this.setState({ series: err ? null : series });
      });
    } else {
      this.setState({ series: null });
    }
  }

  renderLink(item, label) {
    if (!item) return <span className="series-nav__empty" />;
    if (item.loading) return <span className="series-nav__item">{label} ...</span>;
    if (item.missing) {
      return (
        <span className="series-nav__item series-nav__item--missing">
          {label}: nicht gefunden
        </span>
      );
    }
    return (
      <Link className="series-nav__item" to={'/books/' + item.isbn}>
        {label}: {item.title}
      </Link>
    );
  }

  render() {
    const { prev, next, series } = this.state;
    if (!prev && !next) return null;
    return (
      <div className="series-nav">
        {series && series.position > 0 && (
          <div className="series-nav__position">
            Band {series.position} von {series.total}
          </div>
        )}
        <div className="series-nav__links">
          {this.renderLink(prev, '« Vorheriger Band')}
          {this.renderLink(next, 'Nächster Band »')}
        </div>
        {series && series.books.length > 1 && (
          <ol className="series-nav__list">
            {series.books.map(b => (
              <li key={b.isbn} className={b.isbn === this.props.book.isbn ? 'current' : ''}>
                {b.isbn === this.props.book.isbn ? b.title : <Link to={'/books/' + b.isbn}>{b.title}</Link>}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
}

export default SeriesNav;
