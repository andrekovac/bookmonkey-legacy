import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Stars from './Stars.jsx';
import * as session from '../session';
import { formatDate } from '../utils/format';
import { renderMarkdown } from '../utils/markdown';
import '../styles/reviews.css';

export default function Reviews({ isbn }) {
  const [data, setData] = useState(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const user = session.getUser();

  function load() {
    fetch('/api/v1/books/' + encodeURIComponent(isbn) + '/reviews', { credentials: 'include' })
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => setError(err.message));
  }

  useEffect(() => {
    setData(null);
    setEditing(false);
    load();
  }, [isbn]);

  const mine = data ? data.reviews.find(r => r.mine) : null;

  function startEdit() {
    setRating(mine ? mine.rating : 0);
    setText(mine && mine.text ? mine.text : '');
    setEditing(true);
  }

  function submit(e) {
    e.preventDefault();
    if (!rating) {
      setError('Bitte 1 bis 5 Sterne vergeben.');
      return;
    }
    setBusy(true);
    setError(null);
    fetch('/api/v1/books/' + encodeURIComponent(isbn) + '/reviews', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: rating, text: text })
    })
      .then(res => res.json().then(json => ({ ok: res.ok, json: json })))
      .then(({ ok, json }) => {
        setBusy(false);
        if (!ok) return setError(json.message || json.error);
        setData(json);
        setEditing(false);
      })
      .catch(err => {
        setBusy(false);
        setError(err.message);
      });
  }

  function remove(review) {
    if (!window.confirm('Rezension löschen?')) return;
    fetch('/api/v1/reviews/' + review.id, { method: 'DELETE', credentials: 'include' })
      .then(() => load())
      .catch(err => setError(err.message));
  }

  if (!data) return null;

  return (
    <div className="reviews">
      <h3>
        Rezensionen
        {data.count > 0 && (
          <span className="reviews__avg"> <Stars value={data.average} /> {String(data.average).replace('.', ',')} ({data.count})</span>
        )}
      </h3>
      {error && <div className="error">{error}</div>}

      {user && !editing && (
        <button onClick={startEdit}>{mine ? 'Meine Rezension bearbeiten' : 'Rezension schreiben'}</button>
      )}
      {!user && (
        <p className="reviews__login"><Link to={'/login?next=/books/' + encodeURIComponent(isbn)}>Anmelden</Link>, um eine Rezension zu schreiben.</p>
      )}

      {editing && (
        <form className="reviews__form" onSubmit={submit}>
          <div><Stars value={rating} onChange={setRating} size="big" /></div>
          <textarea
            rows="5"
            value={text}
            maxLength={2000}
            placeholder="Wie fandest du das Buch?"
            onChange={e => setText(e.target.value)}
          />
          <div className="reviews__help">Formatierung: **fett**, *kursiv*, [Link](https://...), Zeilen mit "- " werden eine Liste.</div>
          {text && (
            <div className="reviews__preview">
              <div className="reviews__preview-label">Vorschau</div>
              <div className="review__text" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
            </div>
          )}
          <div className="reviews__form-actions">
            <button type="submit" className="primary" disabled={busy}>Speichern</button>
            <button type="button" onClick={() => setEditing(false)}>Abbrechen</button>
          </div>
        </form>
      )}

      {data.count === 0 && <p className="reviews__none">Noch keine Rezensionen.</p>}
      <ul className="reviews__list">
        {data.reviews.map(r => (
          <li key={r.id} className="review">
            <div className="review__head">
              <Stars value={r.rating} />
              <span className="review__author">{r.user_name || 'Anonym'}</span>
              <span className="review__date">{formatDate(r.created_at)}</span>
              {(r.mine || session.isAdmin()) && (
                <a href="#" className="review__delete" onClick={e => { e.preventDefault(); remove(r); }}>löschen</a>
              )}
            </div>
            {r.text && <div className="review__text" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.text) }} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
