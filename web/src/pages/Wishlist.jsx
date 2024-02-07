import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import * as session from '../session';
import useLanguage from '../hooks/useLanguage';
import { formatDate } from '../utils/format';
import '../styles/wishlist.css';

function Note({ item, onSave }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.note || '');

  if (!editing) {
    return (
      <div className="c-wishlist__note">
        {item.note ? <span>{item.note}</span> : <span className="u-muted">{t('wishlist.noNote')}</span>}{' '}
        <button type="button" className="link-button" onClick={() => setEditing(true)}>{t('wishlist.editNote')}</button>
      </div>
    );
  }
  return (
    <form
      className="c-wishlist__note"
      onSubmit={e => {
        e.preventDefault();
        onSave(text).then(() => setEditing(false));
      }}
    >
      <input
        value={text}
        maxLength="200"
        aria-label={t('wishlist.note')}
        onChange={e => setText(e.target.value)}
        autoFocus
      />
      <button type="submit">{t('common.save')}</button>
      <button type="button" className="link-button" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
    </form>
  );
}

export default function Wishlist() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(null);

  function load() {
    return api.get('/wishlist')
      .then(setItems)
      .catch(err => {
        if (err.status === 401) navigate('/login?next=/wishlist');
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function run(item, promise, text) {
    setBusy(item.isbn);
    setError(null);
    setMessage(null);
    return promise
      .then(result => {
        if (text) setMessage(typeof text === 'function' ? text(result) : text);
        return load();
      })
      .catch(err => setError(err.message))
      .finally(() => setBusy(null));
  }

  function remove(item) {
    return run(item, api.del('/wishlist/' + encodeURIComponent(item.isbn)), t('wishlist.removed', { title: item.title }));
  }

  function reserve(item) {
    return run(
      item,
      api.post('/wishlist/' + encodeURIComponent(item.isbn) + '/reserve', { location: (session.getUser() || {}).location }),
      r => t('wishlist.reserved', { title: item.title, position: r.position })
    );
  }

  // a copy is on the shelf: borrow it and take it off the list
  function borrow(item) {
    const req = api.post('/loans', { isbn: item.isbn, location: (session.getUser() || {}).location })
      .then(loan => api.del('/wishlist/' + encodeURIComponent(item.isbn)).then(() => loan));
    return run(item, req, loan => t('wishlist.borrowed', { title: item.title, due: formatDate(loan.due_at) }));
  }

  function saveNote(item, note) {
    return api.put('/wishlist/' + encodeURIComponent(item.isbn), { note: note })
      .then(load)
      .catch(err => setError(err.message));
  }

  return (
    <div className="c-wishlist">
      <h1>{t('wishlist.title')}</h1>
      <p className="u-muted">{t('wishlist.intro')}</p>
      <div aria-live="polite">
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}
      </div>
      {loading && <div className="loading">{t('common.loading')}</div>}
      {!loading && items.length === 0 && (
        <div className="empty">
          {t('wishlist.empty')} <Link to="/">{t('nav.catalogue')}</Link>
        </div>
      )}
      <ul className="c-wishlist__list">
        {items.map(item => (
          <li key={item.isbn} className="c-wishlist__item">
            <img className="c-wishlist__cover" src={item.cover} alt="" loading="lazy" />
            <div className="c-wishlist__body">
              <Link to={'/books/' + item.isbn} className="c-wishlist__title">{item.title}</Link>
              <div className="u-muted">{item.author}</div>
              <div className="c-wishlist__state">
                {item.action === 'borrow' && <span className="c-badge c-badge--ok">{t('wishlist.availableNow', { count: item.available })}</span>}
                {item.action === 'reserve' && <span className="c-badge">{t('wishlist.allOut')}</span>}
                {item.action === 'none' && <span className="c-badge c-badge--muted">{t('wishlist.shopOnly')}</span>}
                {item.action === 'reserved' && (
                  <span className="c-badge c-badge--info">
                    {item.reservation.status === 'ready'
                      ? t('wishlist.ready')
                      : t('wishlist.waiting', { position: item.reservation.position })}
                  </span>
                )}
                <span className="u-muted c-wishlist__added">{t('wishlist.addedAt', { date: formatDate(item.addedAt) })}</span>
              </div>
              <Note item={item} onSave={note => saveNote(item, note)} />
            </div>
            <div className="c-wishlist__actions">
              {item.action === 'borrow' && (
                <button className="primary" disabled={busy === item.isbn} onClick={() => borrow(item)}>{t('wishlist.borrow')}</button>
              )}
              {item.action === 'reserve' && (
                <button className="primary" disabled={busy === item.isbn} onClick={() => reserve(item)}>{t('wishlist.reserve')}</button>
              )}
              <button className="link-button" disabled={busy === item.isbn} onClick={() => remove(item)}>{t('common.remove')}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
