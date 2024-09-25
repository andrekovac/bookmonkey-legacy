import React from 'react';
import xhr from '../api/xhr';
import BookCard from '../components/BookCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import PublisherFilter from '../components/PublisherFilter.jsx';
import Pager from '../components/Pager.jsx';
import withRouter from '../components/withRouter.jsx';
import { t } from '../i18n';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'title:asc', label: 'catalogue.sort.titleAsc' },
  { value: 'title:desc', label: 'catalogue.sort.titleDesc' },
  { value: 'author:asc', label: 'catalogue.sort.author' },
  { value: 'price:asc', label: 'catalogue.sort.priceAsc' },
  { value: 'price:desc', label: 'catalogue.sort.priceDesc' },
  { value: 'published:desc', label: 'catalogue.sort.newest' }
];

function readQuery(search) {
  const params = new URLSearchParams(search);
  return {
    q: params.get('q') || '',
    publisher: params.get('publisher') || '',
    sort: params.get('sort') || 'title:asc',
    available: params.get('available') === '1',
    page: parseInt(params.get('page'), 10) || 1
  };
}

class Catalogue extends React.Component {
  constructor(props) {
    super(props);
    this.state = Object.assign(
      { books: [], total: null, loading: true, error: null },
      readQuery(props.location.search)
    );
    this.onSearch = this.onSearch.bind(this);
    this.onPublisher = this.onPublisher.bind(this);
    this.onSort = this.onSort.bind(this);
    this.onAvailable = this.onAvailable.bind(this);
    this.onPage = this.onPage.bind(this);
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
      available: this.state.available ? 1 : '',
      sort: sortParts[0],
      order: sortParts[1],
      _page: this.state.page,
      _limit: PAGE_SIZE
    };
    if (this.req) this.req.abort();
    this.setState({ loading: true, error: null });
    this.req = xhr.get('/books' + xhr.query(params), (err, books, req) => {
      this.req = null;
      if (err) {
        this.setState({ loading: false, error: err.message });
        return;
      }
      const total = parseInt(req.getResponseHeader('X-Total-Count'), 10);
      this.setState({ loading: false, books: books, total: isNaN(total) ? null : total });
    });
  }

  // put filters into the url so back button and links work
  update(changes) {
    const next = Object.assign(readQuery(this.props.location.search), changes);
    const params = {};
    if (next.q) params.q = next.q;
    if (next.publisher) params.publisher = next.publisher;
    if (next.sort && next.sort !== 'title:asc') params.sort = next.sort;
    if (next.available) params.available = 1;
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

  onAvailable(e) {
    this.update({ available: e.target.checked, page: 1 });
  }

  onPage(page) {
    if (page < 1) return;
    this.update({ page: page });
    window.scrollTo(0, 0);
  }

  render() {
    const { books, total, loading, error, page, q, publisher, sort, available } = this.state;
    return (
      <div className="catalogue">
        <h1>{t('catalogue.title')}</h1>
        <div className="toolbar">
          <SearchBox value={q} onSearch={this.onSearch} />
          <PublisherFilter value={publisher} onChange={this.onPublisher} />
          <select className="sort-select" value={sort} onChange={this.onSort} aria-label={t('search.sort')}>
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{t(o.label)}</option>
            ))}
          </select>
          <label className="toolbar-check">
            <input type="checkbox" checked={available} onChange={this.onAvailable} /> {t('catalogue.onlyAvailable')}
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">{t('catalogue.loading')}</div>}
        {!loading && books.length === 0 && (
          <div className="empty">{q ? t('catalogue.emptyFor', { q: q }) : t('catalogue.empty')}</div>
        )}
        <div className="book-grid">
          {books.map(book => <BookCard key={book.isbn} book={book} />)}
        </div>
        <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={this.onPage} hasMore={books.length === PAGE_SIZE} />
      </div>
    );
  }
}

export default withRouter(Catalogue);
