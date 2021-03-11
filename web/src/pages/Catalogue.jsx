import React from 'react';
import xhr from '../api/xhr';
import BookCard from '../components/BookCard.jsx';
import withRouter from '../components/withRouter.jsx';

const PAGE_SIZE = 12;

class Catalogue extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      books: [],
      loading: true,
      error: null,
      page: 1
    };
    this.prevPage = this.prevPage.bind(this);
    this.nextPage = this.nextPage.bind(this);
  }

  componentDidMount() {
    this.load(1);
  }

  load(page) {
    this.setState({ loading: true, error: null });
    xhr.get('/books' + xhr.query({ _page: page, _limit: PAGE_SIZE }), (err, books) => {
      if (err) {
        this.setState({ loading: false, error: err.message });
        return;
      }
      this.setState({ loading: false, books: books, page: page });
    });
  }

  prevPage() {
    if (this.state.page > 1) this.load(this.state.page - 1);
  }

  nextPage() {
    if (this.state.books.length === PAGE_SIZE) this.load(this.state.page + 1);
  }

  render() {
    const { books, loading, error, page } = this.state;
    return (
      <div className="catalogue">
        <h1>Katalog</h1>
        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">Lade Bücher...</div>}
        <div className="book-grid">
          {books.map(book => <BookCard key={book.isbn} book={book} />)}
        </div>
        <div className="pager">
          <button onClick={this.prevPage} disabled={page <= 1}>&laquo; zurück</button>
          <span className="pager-page">Seite {page}</span>
          <button onClick={this.nextPage} disabled={books.length < PAGE_SIZE}>weiter &raquo;</button>
        </div>
      </div>
    );
  }
}

export default withRouter(Catalogue);
