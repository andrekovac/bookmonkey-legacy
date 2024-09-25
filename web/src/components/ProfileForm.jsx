import React, { useEffect, useState } from 'react';
import xhr from '../api/xhr';
import * as session from '../session';

const LOCATIONS = ['Hamburg', 'Berlin', 'München'];

// Profil im Konto (function component since 2024, still German only)
export default function ProfileForm() {
  const user = session.getUser() || {};
  const [form, setForm] = useState({
    name: user.name || '',
    location: user.location || '',
    department: user.department || '',
    currentPassword: '',
    password: ''
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // the session can arrive after the first render (reload on /account)
  useEffect(() => session.subscribe(u => {
    if (!u) return;
    setForm(f => Object.assign({}, f, {
      name: f.name || u.name || '',
      location: f.location || u.location || '',
      department: f.department || u.department || ''
    }));
  }), []);

  function set(name, value) {
    setForm(f => Object.assign({}, f, { [name]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const body = { name: form.name, location: form.location, department: form.department };
    if (form.password) {
      body.password = form.password;
      body.currentPassword = form.currentPassword;
    }
    setMessage(null);
    setError(null);
    xhr.put('/auth/me', body, err => {
      if (err) {
        setError(err.message);
        return;
      }
      session.load();
      setMessage('Gespeichert.');
      setForm(f => Object.assign({}, f, { password: '', currentPassword: '' }));
    });
  }

  return (
    <form className="form profile-form" onSubmit={onSubmit}>
      <h2>Profil</h2>
      <div aria-live="polite">
        {message && <div className="success">{message}</div>}
        {error && <div className="error" role="alert">{error}</div>}
      </div>
      <label>
        Name
        <input value={form.name} autoComplete="name" onChange={e => set('name', e.target.value)} />
      </label>
      <label>
        Meine Bibliothek
        <select value={form.location} onChange={e => set('location', e.target.value)}>
          <option value="">keine</option>
          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
        </select>
      </label>
      <label>
        Abteilung
        <input value={form.department} autoComplete="organization-title" onChange={e => set('department', e.target.value)} />
      </label>
      <label>
        Aktuelles Passwort
        <input
          type="password"
          value={form.currentPassword}
          autoComplete="current-password"
          onChange={e => set('currentPassword', e.target.value)}
        />
      </label>
      <label>
        Neues Passwort
        <input
          type="password"
          value={form.password}
          autoComplete="new-password"
          minLength={6}
          aria-describedby="password-hint"
          onChange={e => set('password', e.target.value)}
        />
        <small id="password-hint">mindestens 6 Zeichen</small>
      </label>
      <button type="submit">Speichern</button>
    </form>
  );
}
