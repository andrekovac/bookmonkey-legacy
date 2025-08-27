import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as session from '../session';
import useLanguage from '../hooks/useLanguage';

// only local redirects
function nextUrl(search) {
  const next = new URLSearchParams(search).get('next');
  return next && next.charAt(0) === '/' && next.charAt(1) !== '/' ? next : '/';
}

export default function Login() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError(t('login.missing'));
      return;
    }
    setBusy(true);
    setError(null);
    session.login(email, password, err => {
      if (err) {
        setBusy(false);
        setError(err.status === 401 ? t('login.wrong') : err.status === 429 ? t('login.tooMany') : err.message);
        return;
      }
      navigate(nextUrl(location.search));
    });
  }

  return (
    <div className="login">
      <h1>{t('login.title')}</h1>
      <form onSubmit={onSubmit} className="form" noValidate>
        {error && <div className="error" role="alert">{error}</div>}
        <label>
          {t('login.email')}
          <input
            type="email"
            value={email}
            autoComplete="username"
            aria-invalid={!!error}
            onChange={e => setEmail(e.target.value)}
          />
        </label>
        <label>
          {t('login.password')}
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            aria-invalid={!!error}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('login.busy') : t('login.submit')}
        </button>
      </form>
      <p>
        {t('login.newHere')} <Link to="/register">{t('login.register')}</Link>
      </p>
    </div>
  );
}
