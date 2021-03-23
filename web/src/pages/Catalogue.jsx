import React from 'react';
import xhr from '../api/xhr';
import BookCard from '../components/BookCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import PublisherFilter from '../components/PublisherFilter.jsx';
import withRouter from '../components/withRouter.jsx';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'title:asc', label: 'Titel A-Z' },
  { value: 'title:desc', label: 'Titel Z-A' },
  { value: 'author:asc', label: 'Autor' },
  { value: 'price:asc', label: 'Preis aufsteigend' },
  { value: 'price:desc', label: 'Preis absteigend' },
  { value: 'published:desc', label: 'Neueste zuerst' }
];

function readQuery(search) {
  const params = new URLSearchParams(search);
  return {
    q: params.get('q') || '',
    publisher: params.get('publisher') || '',
    sort: params.get('sort') || 'title:asc',
    page: parseInt(params.get('page'), 10) || 1
  };
}

class Catalogue extends React.Component {
  constructor(props) {
    super(props);
    this.state = Object.assign(
      { books: [], loading: true, error: null },
      readQuery(props.location.search)
    );
    this.onSearch = this.onSearch.bind(this);
    this.onPublisher = this.onPublisher.bind(this);
    this.onSort = this.onSort.bind(this);
    this.prevPage = this.prevPage.bind(this);
    this.nextPage = this.nextPage.bind(this);
  }

  componentDidMount() {
    this.load();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.location.search !== this.props.location.search) {
      this.setState(readQuery(this.props.location.search), () => this.load());
    }
  }

  componentWillUnmount() {
    if (this.req) this.req.abort();
  }

  load() {
    const sortParts = this.state.sort.split(':');
    const params = {
      q: this.state.q,
      publisher: this.state.publisher,
      sort: sortParts[0],
      order: sortParts[1],
      _page: this.state.page,
      _limit: PAGE_SIZE
    };
    if (this.req) this.req.abort();
    this.setState({ loading: true, error: null });
    this.req = xhr.get('/books' + xhr.query(params), (err, books) => {
      this.req = null;
      if (err) {
        this.setState({ loading: false, error: err.message });
        return;
      }
      this.setState({ loading: false, books: books });
    });
  }

  // put filters into the url so back button and links work
  update(changes) {
    const next = Object.assign(readQuery(this.props.location.search), changes);
    const params = {};
    if (next.q) params.q = next.q;
    if (next.publisher) params.publisher = next.publisher;
    if (next.sort && next.sort !== 'title:asc') params.sort = next.sort;
    if (next.page > 1) params.page = next.page;
    this.props.navigate('/' + xhr.query(params));
  }

  onSearch(q) {
    this.update({ q: q, page: 1 });
  }

  onPublisher(publisher) {
    this.update({ publisher: publisher, page: 1 });
  }

  onSort(e) {
    this.update({ sort: e.target.value, page: 1 });
  }

  prevPage() {
    if (this.state.page > 1) this.update({ page: this.state.page - 1 });
  }

  nextPage() {
    if (this.state.books.length === PAGE_SIZE) this.update({ page: this.state.page + 1 });
  }

  render() {
    const { books, loading, error, page, q, publisher, sort } = this.state;
    return (
      <div className="catalogue">
        <h1>Katalog</h1>
        <div className="toolbar">
          <SearchBox value={q} onSearch={this.onSearch} />
          <PublisherFilter value={publisher} onChange={this.onPublisher} />
          <select className="sort-select" value={sort} onChange={this.onSort}>
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">Lade Bücher...</div>}
        {!loading && books.length === 0 && (
          <div className="empty">Keine Bücher gefunden{q ? ' für "' + q + '"' : ''}.</div>
        )}
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
