import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import * as session from '../session';
import useLanguage from '../hooks/useLanguage';

// "Merken" on the detail page. Toggles the book on the Merkliste.
export default function WishlistButton({ isbn }) {
  const { t } = useLanguage();
  const [user, setUser] = useState(session.getUser());
  const [onList, setOnList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => session.subscribe(setUser), []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api.get('/wishlist')
      .then(items => {
        if (alive) setOnList(items.some(i => i.isbn === isbn));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isbn, user]);

  if (!user) return null;

  function toggle() {
    setBusy(true);
    setError(null);
    const req = onList
      ? api.del('/wishlist/' + encodeURIComponent(isbn))
      : api.post('/wishlist', { isbn: isbn });
    req
      .then(() => setOnList(!onList))
      .catch(err => setError(err.message))
      .finally(() => setBusy(false));
  }

  return (
    <div className="c-wishlist-button">
      <button
        type="button"
        className={onList ? 'c-wishlist-button__toggle is-active' : 'c-wishlist-button__toggle'}
        onClick={toggle}
        disabled={busy}
        aria-pressed={onList}
      >
        {onList ? '★ ' + t('wishlist.onList') : '☆ ' + t('wishlist.add')}
      </button>
      {onList && <Link to="/wishlist" className="c-wishlist-button__link">{t('wishlist.open')}</Link>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
