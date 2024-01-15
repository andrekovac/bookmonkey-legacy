import React from 'react';
import { Link } from 'react-router-dom';
import xhr from '../api/xhr';
import withRouter from '../components/withRouter.jsx';
import SeriesNav from '../components/SeriesNav.jsx';
import Price from '../components/Price.jsx';
import Availability from '../components/Availability.jsx';
import Reviews from '../components/Reviews.jsx';
import * as cart from '../cart';
import * as session from '../session';
import { formatDate, joinAuthors } from '../utils/format';
import { t } from '../i18n';
import '../styles/detail.css';
import '../styles/library.css';

class Detail extends React.Component {
  constructor(props) {
    super(props);
    this.state = { book: null, loading: true, error: null, added: false };
    this.addToCart = this.addToCart.bind(this);
  }

  componentDidMount() {
    this.load();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params.isbn !== this.props.params.isbn) {
      this.load();
      window.scrollTo(0, 0);
    }
  }

  load() {
    this.setState({ loading: true, error: null });
    xhr.get('/books/' + encodeURIComponent(this.props.params.isbn), (err, book) => {
      if (err) {
        this.setState({
          loading: false,
          book: null,
          error: err.status === 404 ? t('detail.notFound') : err.message
        });
        return;
      }
      document.title = book.title + ' - BookMonkey';
      this.setState({ loading: false, book: book, added: false });
    });
  }

  addToCart() {
    if (!session.getUser()) {
      this.props.navigate('/login?next=' + encodeURIComponent(this.props.location.pathname));
      return;
    }
    cart.add(this.state.book.isbn, 1, (err) => {
      if (err) return this.setState({ error: err.message });
      this.setState({ added: true });
    });
  }

  render() {
    const { book, loading, error, added } = this.state;
    if (loading) return <div className="loading">Lade...</div>;
    if (error) {
      return (
        <div>
          <div className="error">{error}</div>
          <Link to="/">{t('detail.backToCatalogue')}</Link>
        </div>
      );
    }
    return (
      <div className="detail">
        <Link to="/" className="detail-back">{t('detail.back')}</Link>
        <div className="detail-main">
          <img className="detail-cover" src={book.cover} alt={book.title} />
          <div className="detail-info">
            <h1 className="detail-title">{book.title}</h1>
            {book.subtitle && <h2 className="detail-subtitle">{book.subtitle}</h2>}
            <div className="detail-author">{joinAuthors(book.author, book.coAuthors)}</div>
            <table className="detail-facts">
              <tbody>
                <tr><th>{t('detail.publisher')}</th><td>{book.publisher}</td></tr>
                <tr><th>{t('detail.published')}</th><td>{formatDate(book.publishedAt)}</td></tr>
                <tr><th>{t('detail.pages')}</th><td>{book.numPages}</td></tr>
                <tr><th>{t('detail.isbn')}</th><td>{book.isbn}</td></tr>
              </tbody>
            </table>
            <div className="detail-price"><Price book={book} showVat /></div>
            <button className="primary" onClick={this.addToCart}>{t('detail.addToCart')}</button>
            {added && <span className="detail-added"> {t('detail.added')}</span>}
            <Availability isbn={book.isbn} />
            <SeriesNav book={book} />
          </div>
        </div>
        <div className="detail-abstract">
          <h3>{t('detail.description')}</h3>
          <p>{book.abstract}</p>
        </div>
        <Reviews isbn={book.isbn} />
      </div>
    );
  }
}

export default withRouter(Detail);
