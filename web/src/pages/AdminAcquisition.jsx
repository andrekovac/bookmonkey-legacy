import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminOnly from '../components/AdminOnly.jsx';

const EMPTY = {
  isbn: '',
  title: '',
  subtitle: '',
  author: '',
  publisher: '',
  numPages: '',
  publishedAt: '',
  price: '',
  copies: 1,
  location: 'Hamburg',
  shelf: '',
  note: ''
};

// Neuanschaffung: book + copies in one go. Copied from AdminCopies, form like admin-old.
export default function AdminAcquisition() {
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  function set(field) {
    return e => setForm(Object.assign({}, form, { [field]: e.target.value }));
  }

  function submit(e) {
    e.preventDefault();
    const errs = [];
    if (!form.isbn.trim()) errs.push('ISBN fehlt');
    if (!form.title.trim()) errs.push('Titel fehlt');
    if (errs.length) return setErrors(errs);

    setBusy(true);
    setErrors([]);
    fetch('/api/v1/admin/acquisitions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then(res => res.json().then(json => ({ ok: res.ok, json: json })))
      .then(({ ok, json }) => {
        setBusy(false);
        if (!ok) return setErrors([json.message || json.error]);
        setResult(json);
        setForm(Object.assign({}, EMPTY, { location: form.location }));
      })
      .catch(err => {
        setBusy(false);
        setErrors([err.message]);
      });
  }

  return (
    <AdminOnly>
      <h1>Neuanschaffung</h1>
      {result && (
        <div className="success">
          {result.created ? 'Neues Buch angelegt: ' : 'Buch war schon im Katalog: '}
          <Link to={'/books/' + result.book.isbn}>{result.book.title}</Link>.{' '}
          Exemplare: {result.copies.map(c => c.barcode + (c.status === 'on_hold' ? ' (Abholregal!)' : '')).join(', ')}
        </div>
      )}
      {errors.length > 0 && <div className="error">{errors.join(', ')}</div>}
      <form className="form form--wide" onSubmit={submit}>
        <div className="form-row">
          <label>ISBN<input value={form.isbn} onChange={set('isbn')} placeholder="978..." /></label>
          <label>Preis netto (für den Shop)<input value={form.price} onChange={set('price')} placeholder="12,99" /></label>
        </div>
        <label>Titel<input value={form.title} onChange={set('title')} /></label>
        <label>Untertitel<input value={form.subtitle} onChange={set('subtitle')} /></label>
        <div className="form-row">
          <label>Autor<input value={form.author} onChange={set('author')} /></label>
          <label>Verlag<input value={form.publisher} onChange={set('publisher')} /></label>
        </div>
        <div className="form-row">
          <label>Seiten<input value={form.numPages} onChange={set('numPages')} /></label>
          <label>Erschienen (JJJJ-MM-TT)<input value={form.publishedAt} onChange={set('publishedAt')} /></label>
        </div>
        <fieldset>
          <legend>Exemplare</legend>
          <div className="form-row">
            <label>Anzahl<input type="number" min="1" max="20" value={form.copies} onChange={set('copies')} /></label>
            <label>
              Standort
              <select value={form.location} onChange={set('location')}>
                <option>Hamburg</option>
                <option>Berlin</option>
                <option>München</option>
              </select>
            </label>
            <label>Regal<input value={form.shelf} onChange={set('shelf')} /></label>
          </div>
          <label>Notiz<input value={form.note} onChange={set('note')} placeholder="z.B. Spende von ..." /></label>
        </fieldset>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Moment...' : 'Anlegen'}</button>
      </form>
    </AdminOnly>
  );
}
