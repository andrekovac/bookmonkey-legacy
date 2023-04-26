import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FIELDS = [
  { name: 'title', label: 'Titel', required: true },
  { name: 'subtitle', label: 'Untertitel' },
  { name: 'author', label: 'Autor' },
  { name: 'coAuthors', label: 'weitere Autoren (Komma)' },
  { name: 'publisher', label: 'Verlag' },
  { name: 'numPages', label: 'Seiten', type: 'number', small: true },
  { name: 'publishedAt', label: 'erschienen', type: 'date', small: true },
  { name: 'price', label: 'Preis netto (EUR)', small: true },
  { name: 'predecessorIsbn', label: 'Vorheriger Band (ISBN)' },
  { name: 'successorIsbn', label: 'Nächster Band (ISBN)' }
];

function toForm(book) {
  const out = {};
  FIELDS.forEach(f => {
    let value = book[f.name];
    if (f.name === 'coAuthors' && Array.isArray(value)) value = value.join(', ');
    out[f.name] = value === null || value === undefined ? '' : String(value);
  });
  out.abstract = book.abstract || '';
  return out;
}

// only send what was changed
function changesOf(initial, values) {
  const out = {};
  Object.keys(values).forEach(key => {
    if (values[key] !== initial[key]) out[key] = values[key];
  });
  return out;
}

export default function BookForm({ book, onSave, onCancel }) {
  const [initial] = useState(() => toForm(book));
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changes = changesOf(initial, values);
  const dirty = Object.keys(changes).length > 0;

  function set(name, value) {
    setValues(Object.assign({}, values, { [name]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    Promise.resolve(onSave(changes)).finally(() => setSaving(false));
  }

  return (
    <form className="admin-box book-form" onSubmit={submit}>
      <h3>
        {book.title}{' '}
        <Link className="book-form__open" to={'/books/' + encodeURIComponent(book.isbn)} target="_blank">im Katalog</Link>
      </h3>
      <div className="admin-table__sub mono">ISBN {book.isbn}</div>
      <div className="book-form__grid">
        {FIELDS.map(f => (
          <label key={f.name} className={f.small ? 'book-form__field book-form__field--small' : 'book-form__field'}>
            {f.label}
            <input
              type={f.type || 'text'}
              value={values[f.name]}
              required={f.required}
              onChange={e => set(f.name, e.target.value)}
            />
          </label>
        ))}
      </div>
      <label className="book-form__field">
        Beschreibung
        <textarea rows="6" value={values.abstract} onChange={e => set('abstract', e.target.value)} />
      </label>
      <div className="book-form__actions">
        <button className="primary" type="submit" disabled={!dirty || saving}>{saving ? 'Speichere...' : 'Speichern'}</button>{' '}
        <button type="button" onClick={onCancel}>Schließen</button>
        {dirty && <span className="admin-count"> {Object.keys(changes).length} Änderung(en)</span>}
      </div>
    </form>
  );
}
