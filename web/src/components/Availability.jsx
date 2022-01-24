import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as session from '../session';

// "Verfügbar in Hamburg (1 von 2)" box on the detail page, with the borrow button
export default function Availability({ isbn }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState('');
  const user = session.getUser();

  function load() {
    fetch('/api/v1/books/' + encodeURIComponent(isbn) + '/availability', { credentials: 'include' })
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => setError(err.message));
  }

  useEffect(() => {
    setData(null);
    setMessage(null);
    setError(null);
    load();
  }, [isbn]);

  function borrow() {
    setBusy(true);
    setError(null);
    fetch('/api/v1/loans', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbn: isbn, location: location || undefined })
    })
      .then(res => res.json().then(json => ({ ok: res.ok, json: json })))
      .then(({ ok, json }) => {
        setBusy(false);
        if (!ok) {
          setError(json.message || json.error || 'Ausleihe nicht möglich');
          return;
        }
        setMessage('Ausgeliehen! Bitte bis ' + json.due_at.split('-').reverse().join('.') + ' zurückgeben. Exemplar ' + json.barcode + ' (' + json.location + ')');
        load();
      })
      .catch(err => {
        setBusy(false);
        setError(err.message);
      });
  }

  if (!data) return <div className="availability availability--loading">Verfügbarkeit wird geladen...</div>;
  if (data.total === 0) {
    return <div className="availability availability--none">Nicht in der Bibliothek, nur im Shop erhältlich.</div>;
  }

  return (
    <div className="availability">
      <div className="availability__summary">
        {data.available > 0
          ? <strong className="availability__ok">Verfügbar</strong>
          : <strong className="availability__out">Alle Exemplare ausgeliehen</strong>}
        {' '}({data.available} von {data.total})
      </div>
      <ul className="availability__locations">
        {data.locations.map(l => (
          <li key={l.location}>{l.location}: {l.available} / {l.total}</li>
        ))}
      </ul>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
      {data.available > 0 && !message && (
        user ? (
          <div className="availability__actions">
            <select value={location} onChange={e => setLocation(e.target.value)}>
              <option value="">egal wo</option>
              {data.locations.filter(l => l.available > 0).map(l => (
                <option key={l.location} value={l.location}>{l.location}</option>
              ))}
            </select>
            <button className="primary" onClick={borrow} disabled={busy}>
              {busy ? 'Moment...' : 'Ausleihen'}
            </button>
          </div>
        ) : (
          <div className="availability__actions">
            <Link to={'/login?next=/books/' + encodeURIComponent(isbn)}>Anmelden</Link> zum Ausleihen
          </div>
        )
      )}
    </div>
  );
}
