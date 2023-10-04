import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AdminOnly from '../components/AdminOnly.jsx';
import { formatDate, formatPrice } from '../utils/format';
import '../styles/admin-books.css';

const STATUS = {
  available: 'im Regal',
  on_loan: 'ausgeliehen',
  on_hold: 'Abholregal',
  repair: 'Reparatur',
  lost: 'verloren'
};

// ISBN-Schnellsuche: scan the barcode on the back of a book (the scanner types the digits
// and Enter) and see if we have it and where the copies are.
// Uses /api/v2 for the book because v2 says what is wrong with an isbn.
export default function AdminLookup() {
  const [value, setValue] = useState('');
  const [book, setBook] = useState(null);
  const [copies, setCopies] = useState([]);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const input = useRef(null);

  useEffect(() => {
    if (input.current) input.current.focus();
  }, []);

  function lookup(e) {
    e.preventDefault();
    const isbn = value.trim();
    if (!isbn) return;
    setError(null);
    setBook(null);
    setCopies([]);
    api.get('/api/v2/books/' + encodeURIComponent(isbn))
      .then(found => {
        setBook(found);
        setHistory([{ isbn: found.isbn, title: found.title }].concat(history.filter(h => h.isbn !== found.isbn)).slice(0, 8));
        return api.get('/admin/copies', { query: { isbn: found.isbn } });
      })
      .then(list => setCopies(list || []))
      .catch(err => {
        if (err.status === 404) setError('Nicht im Katalog: ' + isbn);
        else setError(err.message);
      })
      .finally(() => {
        setValue('');
        if (input.current) input.current.focus();
      });
  }

  return (
    <AdminOnly>
      <form className="admin-box lookup" onSubmit={lookup}>
        <h3>ISBN-Schnellsuche</h3>
        <input
          ref={input}
          className="lookup__input mono"
          placeholder="ISBN scannen oder eingeben"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <button type="submit">Suchen</button>
      </form>

      {error && (
        <div className="error">
          {error}{' '}
          {error.indexOf('Nicht im Katalog') === 0 && <Link to="/admin/acquisition">Neuanschaffung</Link>}
        </div>
      )}

      {book && (
        <div className="admin-box lookup__result">
          <img src={book.links.cover} alt="" />
          <div>
            <h3>{book.title}</h3>
            {book.subtitle && <div>{book.subtitle}</div>}
            <div>{book.author} &middot; {book.publisher} &middot; {formatDate(book.publishedAt)}</div>
            <div className="admin-table__sub mono">{book.isbn}</div>
            <div>{formatPrice(book.price.gross, book.price.currency)} brutto</div>
            <table className="admin-table lookup__copies">
              <thead>
                <tr><th>Barcode</th><th>Standort</th><th>Regal</th><th>Status</th></tr>
              </thead>
              <tbody>
                {copies.map(c => (
                  <tr key={c.id} className={'admin-table__row--' + c.status}>
                    <td className="mono">{c.barcode}</td>
                    <td>{c.location}</td>
                    <td>{c.shelf}</td>
                    <td>{STATUS[c.status] || c.status}</td>
                  </tr>
                ))}
                {!copies.length && <tr><td colSpan="4" className="admin-count">Keine Exemplare.</td></tr>}
              </tbody>
            </table>
            <p>
              <Link to={'/books/' + encodeURIComponent(book.isbn)}>im Katalog</Link> &middot;{' '}
              <Link to="/admin/copies">Exemplare verwalten</Link>
            </p>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="admin-count">
          Zuletzt:{' '}
          {history.map((h, idx) => (
            <span key={h.isbn}>{idx > 0 && ', '}{h.title}</span>
          ))}
        </div>
      )}
    </AdminOnly>
  );
}
