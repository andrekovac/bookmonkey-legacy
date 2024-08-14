import React, { useEffect, useState } from 'react';
import api from '../api/client';
import BookCard from '../components/BookCard.jsx';
import PublisherFilter from '../components/PublisherFilter.jsx';
import Pager from '../components/Pager.jsx';
import useDebounce from '../hooks/useDebounce';
import useLanguage from '../hooks/useLanguage';
import '../styles/search.css';

// "Neue Suche" (2024, flag ENABLE_NEW_SEARCH): results while typing, search in the
// description too. The old page (Catalogue.jsx + SearchBox) stays until everybody is happy.
const PAGE_SIZE = 12;
const MIN_CHARS = 2;
const DELAY_MS = 300;

const SORT_OPTIONS = [
  { value: 'title:asc', label: 'catalogue.sort.titleAsc' },
  { value: 'title:desc', label: 'catalogue.sort.titleDesc' },
  { value: 'author:asc', label: 'catalogue.sort.author' },
  { value: 'price:asc', label: 'catalogue.sort.priceAsc' },
  { value: 'price:desc', label: 'catalogue.sort.priceDesc' },
  { value: 'published:desc', label: 'catalogue.sort.newest' }
];

// "... the dark lord [Sauron] ..." with the hit marked
function Snippet({ snippet }) {
  if (!snippet) return null;
  const before = snippet.text.slice(0, snippet.start);
  const hit = snippet.text.slice(snippet.start, snippet.start + snippet.length);
  const after = snippet.text.slice(snippet.start + snippet.length);
  return (
    <div className="c-search__snippet">
      {before}<mark>{hit}</mark>{after}
    </div>
  );
}

export default function CatalogueNew() {
  const { t } = useLanguage();
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [publisher, setPublisher] = useState('');
  const [sort, setSort] = useState('title:asc');
  const [available, setAvailable] = useState(false);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function search(q, toPage) {
    const parts = sort.split(':');
    setLoading(true);
    setError(null);
    setQuery(q);
    return api.get('/books', {
      query: {
        q: q.length >= MIN_CHARS ? q : '',
        publisher: publisher,
        available: available,
        sort: parts[0],
        order: parts[1],
        _page: toPage || 1,
        _limit: PAGE_SIZE
      },
      raw: true
    })
      .then(({ data, res }) => {
        setBooks(data);
        const n = parseInt(res.headers.get('X-Total-Count'), 10);
        setTotal(isNaN(n) ? null : n);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  const searchLater = useDebounce(search, DELAY_MS);

  // filters, sort and paging: right away
  useEffect(() => {
    search(term, page);
  }, [page, publisher, sort, available]);

  function onType(e) {
    const value = e.target.value;
    setTerm(value);
    if (page !== 1) setPage(1);
    if (value.trim().length >= MIN_CHARS || value.trim() === '') searchLater(value.trim(), 1);
  }

  function clear() {
    setTerm('');
    setPage(1);
    search('', 1);
  }

  function onPage(p) {
    setPage(p);
    window.scrollTo(0, 0);
  }

  const searching = query.length >= MIN_CHARS;

  return (
    <div className="catalogue c-search">
      <h1>{t('catalogue.title')}</h1>
      <div className="toolbar">
        <div className="c-search__box" role="search">
          <input
            type="search"
            className="c-search__input"
            placeholder={t('search.placeholder')}
            aria-label={t('search.label')}
            value={term}
            onChange={onType}
            autoComplete="off"
          />
          {term && (
            <button type="button" className="c-search__clear" onClick={clear} aria-label={t('search.clear')}>
              &times;
            </button>
          )}
        </div>
        <PublisherFilter value={publisher} onChange={p => { setPublisher(p); setPage(1); }} />
        <select className="sort-select" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} aria-label={t('search.sort')}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </select>
        <label className="toolbar-check">
          <input type="checkbox" checked={available} onChange={e => { setAvailable(e.target.checked); setPage(1); }} /> {t('catalogue.onlyAvailable')}
        </label>
      </div>
      <div className="c-search__status" aria-live="polite">
        {loading && <span className="loading">{t('catalogue.loading')}</span>}
        {!loading && searching && total !== null && <span className="u-muted">{t('search.results', { q: query })}</span>}
      </div>
      {error && <div className="error">{error}</div>}
      {!loading && books.length === 0 && (
        <div className="empty">{searching ? t('catalogue.emptyFor', { q: query }) : t('catalogue.empty')}</div>
      )}
      <div className="book-grid">
        {books.map(book => (
          <div key={book.isbn} className="c-search__hit">
            <BookCard book={book} />
            {book.matchedIn === 'abstract' && <Snippet snippet={book.snippet} />}
          </div>
        ))}
      </div>
      <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={onPage} hasMore={books.length === PAGE_SIZE} />
    </div>
  );
}
