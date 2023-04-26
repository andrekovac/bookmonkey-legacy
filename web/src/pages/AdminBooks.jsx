import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AdminOnly from '../components/AdminOnly.jsx';
import BookForm from '../components/BookForm.jsx';
import { formatPrice } from '../utils/format';
import '../styles/admin-books.css';

const PAGE_SIZE = 25;

// Bücher im neuen Admin. Replaces the books part of /admin-old step by step.
export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [q, setQ] = useState('');
  const [publisher, setPublisher] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    return api.get('/books', { query: { q: q, publisher: publisher, _page: page, _limit: PAGE_SIZE } })
      .then(setBooks)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [page, publisher]);

  useEffect(() => {
    api.get('/publishers').then(setPublishers).catch(() => setPublishers([]));
  }, []);

  function search(e) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else load();
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
            <input placeholder="Titel oder Autor" value={q} onChange={e => setQ(e.target.value)} />
            <select value={publisher} onChange={e => { setPublisher(e.target.value); setPage(1); }}>
              <option value="">alle Verlage</option>
              {publishers.map(p => <option key={p.publisher} value={p.publisher}>{p.publisher} ({p.count})</option>)}
            </select>
            <button type="submit">Suchen</button>
            <Link className="admin-tabs__job" to="/admin/acquisition">+ Neuanschaffung</Link>
          </form>

          {error && <div className="error">{error}</div>}

          <table className="admin-table books-admin__table">
            <thead>
              <tr>
                <th></th>
                <th>Titel</th>
                <th>Autor</th>
                <th>Verlag</th>
                <th className="num">Seiten</th>
                <th className="num">Preis netto</th>
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
                  <td className="num">{b.numPages}</td>
                  <td className="num">{formatPrice(b.price, b.currency)}</td>
                </tr>
              ))}
              {!books.length && !loading && (
                <tr><td colSpan="6" className="admin-count">Keine Bücher gefunden.</td></tr>
              )}
            </tbody>
          </table>

          <div className="books-admin__pager">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>« zurück</button>
            <span className="admin-count">Seite {page}</span>
            <button disabled={books.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>weiter »</button>
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
