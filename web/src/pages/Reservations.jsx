import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/format';
import '../styles/library.css';

const STATUS = {
  waiting: 'Warteliste',
  ready: 'Liegt bereit',
  fulfilled: 'Ausgeliehen',
  cancelled: 'Storniert',
  expired: 'Abgelaufen'
};

// copy of Loans.jsx, same structure
export default function Reservations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  function load() {
    fetch('/api/v1/reservations' + (showAll ? '?all=1' : ''), { credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          navigate('/login?next=/reservations');
          return null;
        }
        return res.json();
      })
      .then(json => {
        if (!json) return;
        setItems(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, [showAll]);

  function cancel(r) {
    if (!window.confirm('Vormerkung für "' + r.title + '" wirklich löschen?')) return;
    setError(null);
    fetch('/api/v1/reservations/' + r.id, { method: 'DELETE', credentials: 'include' })
      .then(res => res.json().then(json => ({ ok: res.ok, json: json })))
      .then(({ ok, json }) => {
        if (!ok) {
          setError(json.message || json.error);
          return;
        }
        setNotice('Vormerkung gelöscht.');
        load();
      })
      .catch(err => setError(err.message));
  }

  return (
    <div className="reservations">
      <h1>Meine Vormerkungen</h1>
      <p className="loans__hint">
        Wenn ein Exemplar zurückkommt, bekommt es die erste Person auf der Warteliste.
        Du hast dann 48 Stunden Zeit, es abzuholen.
      </p>
      <label className="reservations__all">
        <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> auch erledigte zeigen
      </label>
      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Lade...</div>}
      {!loading && items.length === 0 && (
        <div className="empty">Keine Vormerkungen. Bücher, die gerade alle ausgeliehen sind, kannst du auf der Buchseite vormerken.</div>
      )}
      {items.length > 0 && (
        <table className="loans-table">
          <thead>
            <tr>
              <th></th>
              <th>Buch</th>
              <th>Vorgemerkt am</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className={r.status === 'ready' ? 'loans-table__row--ready' : ''}>
                <td><img className="loans-table__cover" src={r.cover} alt="" /></td>
                <td>
                  <Link to={'/books/' + r.isbn}>{r.title}</Link>
                  <div className="loans-table__author">{r.author}</div>
                </td>
                <td>{formatDate(r.created_at)}</td>
                <td>
                  {STATUS[r.status] || r.status}
                  {r.status === 'waiting' && <div className="due">Platz {r.position}</div>}
                  {r.status === 'ready' && (
                    <div className="due">in {r.copy_location}, bis {r.expires_at.slice(8, 10)}.{r.expires_at.slice(5, 7)}. {r.expires_at.slice(11, 16)} Uhr</div>
                  )}
                </td>
                <td className="loans-table__actions">
                  {(r.status === 'waiting' || r.status === 'ready') && (
                    <button onClick={() => cancel(r)}>Löschen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
