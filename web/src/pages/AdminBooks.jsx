import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AdminOnly from '../components/AdminOnly.jsx';
import BookForm from '../components/BookForm.jsx';
import Pager from '../components/Pager.jsx';
import { formatDate, formatPrice } from '../utils/format';
import '../styles/admin-books.css';

const PAGE_SIZE = 25;

const COLUMNS = [
  { key: 'title', label: 'Titel' },
  { key: 'author', label: 'Autor' },
  { key: 'publisher', label: 'Verlag' },
  { key: 'publishedAt', label: 'erschienen' },
  { key: 'numPages', label: 'Seiten', num: true },
  { key: 'price', label: 'Preis netto', num: true }
];

function SortHeader({ column, sort, onSort }) {
  const active = sort.key === column.key;
  const arrow = active ? (sort.order === 'desc' ? ' ▼' : ' ▲') : '';
  return (
    <th
      className={(column.num ? 'num ' : '') + 'books-admin__sort' + (active ? ' books-admin__sort--active' : '')}
      aria-sort={active ? (sort.order === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      <button type="button" className="link-button" onClick={() => onSort(column.key)}>{column.label}{arrow}</button>
    </th>
  );
}

// Bücher im neuen Admin. Replaces the books part of /admin-old step by step.
export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(null);
  const [publishers, setPublishers] = useState([]);
  const [q, setQ] = useState('');
  const [publisher, setPublisher] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'title', order: 'asc' });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    return api.get('/books', {
      query: { q: q, publisher: publisher, _sort: sort.key, _order: sort.order, _page: page, _limit: PAGE_SIZE },
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

  useEffect(() => {
    load();
  }, [page, publisher, sort]);

  useEffect(() => {
    api.get('/publishers').then(setPublishers).catch(() => setPublishers([]));
  }, []);

  function search(e) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else load();
  }

  function changeSort(key) {
    setPage(1);
    setSort(sort.key === key ? { key: key, order: sort.order === 'asc' ? 'desc' : 'asc' } : { key: key, order: 'asc' });
  }

  function open(isbn) {
    setNotice(null);
    setError(null);
    api.get('/books/' + encodeURIComponent(isbn))
      .then(setSelected)
      .catch(err => setError(err.message));
  }

  function save(changes) {
    setNotice(null);
    setError(null);
    return api.put('/books/' + encodeURIComponent(selected.isbn), changes)
      .then(book => {
        setSelected(book);
        setNotice('Gespeichert');
        load();
      })
      .catch(err => setError(err.message));
  }

  return (
    <AdminOnly>
      <div className="books-admin">
        <div className="books-admin__list">
          <form className="admin-tabs" onSubmit={search}>
            <input placeholder="Titel oder Autor" aria-label="Titel oder Autor" value={q} onChange={e => setQ(e.target.value)} />
            <select value={publisher} aria-label="Verlag" onChange={e => { setPublisher(e.target.value); setPage(1); }}>
              <option value="">alle Verlage</option>
              {publishers.map(p => <option key={p.publisher} value={p.publisher}>{p.publisher} ({p.count})</option>)}
            </select>
            <button type="submit">Suchen</button>
            <Link className="admin-tabs__job" to="/admin/acquisition">+ Neuanschaffung</Link>
            <a
              className="admin-tabs__job"
              href={'/api/v1/admin/export/books.csv' + (publisher ? '?publisher=' + encodeURIComponent(publisher) : '')}
              download
            >
              Export (CSV)
            </a>
          </form>

          {error && <div className="error">{error}</div>}

          <table className="admin-table books-admin__table">
            <thead>
              <tr>
                <th></th>
                {COLUMNS.map(c => <SortHeader key={c.key} column={c} sort={sort} onSort={changeSort} />)}
              </tr>
            </thead>
            <tbody>
              {books.map(b => (
                <tr
                  key={b.isbn}
                  className={'admin-table__row--click' + (selected && selected.isbn === b.isbn ? ' books-admin__row--selected' : '')}
                  onClick={() => open(b.isbn)}
                >
                  <td><img className="books-admin__cover" src={b.cover} alt="" loading="lazy" /></td>
                  <td>{b.title}<div className="admin-table__sub mono">{b.isbn}</div></td>
                  <td>{b.author}</td>
                  <td>{b.publisher}</td>
                  <td>{formatDate(b.publishedAt)}</td>
                  <td className="num">{b.numPages}</td>
                  <td className="num">{formatPrice(b.price, b.currency)}</td>
                </tr>
              ))}
              {!books.length && !loading && (
                <tr><td colSpan="7" className="admin-count">Keine Bücher gefunden.</td></tr>
              )}
            </tbody>
          </table>

          <div className="books-admin__pager">
            <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} hasMore={books.length === PAGE_SIZE} />
          </div>
        </div>

        <div className="books-admin__edit">
          {notice && <div className="books-admin__notice">{notice}</div>}
          {selected ? (
            <BookForm key={selected.isbn} book={selected} onSave={save} onCancel={() => setSelected(null)} />
          ) : (
            <p className="admin-count">Buch in der Liste anklicken zum Bearbeiten.</p>
          )}
        </div>
      </div>
    </AdminOnly>
  );
}
