import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AdminOnly from '../components/AdminOnly.jsx';
import '../styles/admin-books.css';

function move(list, from, to) {
  const copy = list.slice();
  const item = copy.splice(from, 1)[0];
  copy.splice(to, 0, item);
  return copy;
}

function SeriesEditor({ initial, onSaved, onCancel }) {
  const [volumes, setVolumes] = useState(initial ? initial.volumes : []);
  const [isbn, setIsbn] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function add(e) {
    e.preventDefault();
    setError(null);
    const value = isbn.trim();
    if (!value) return;
    api.get('/books/' + encodeURIComponent(value))
      .then(book => {
        if (volumes.some(v => v.isbn === book.isbn)) return setError('Das Buch ist schon in der Serie.');
        setVolumes(volumes.concat([{ isbn: book.isbn, title: book.title, author: book.author, cover: book.cover }]));
        setIsbn('');
      })
      .catch(err => setError(err.status === 404 ? 'Kein Buch mit dieser ISBN.' : err.message));
  }

  function save() {
    setSaving(true);
    setError(null);
    api.put('/admin/series', { isbns: volumes.map(v => v.isbn) })
      .then(onSaved)
      .catch(err => setError(err.message))
      .finally(() => setSaving(false));
  }

  return (
    <div className="admin-box series-editor">
      <h3>{initial ? 'Serie bearbeiten: ' + initial.name : 'Neue Serie'}</h3>
      {error && <div className="error">{error}</div>}
      <ol className="series-editor__list">
        {volumes.map((v, idx) => (
          <li key={v.isbn}>
            <img className="books-admin__cover" src={v.cover} alt="" />
            <span className="series-editor__title">
              {v.title}
              <span className="admin-table__sub mono"> {v.isbn}</span>
            </span>
            <button type="button" disabled={idx === 0} onClick={() => setVolumes(move(volumes, idx, idx - 1))}>▲</button>
            <button type="button" disabled={idx === volumes.length - 1} onClick={() => setVolumes(move(volumes, idx, idx + 1))}>▼</button>
            <button type="button" onClick={() => setVolumes(volumes.filter(x => x.isbn !== v.isbn))}>entfernen</button>
          </li>
        ))}
      </ol>
      <form onSubmit={add}>
        <input placeholder="ISBN hinzufügen" value={isbn} onChange={e => setIsbn(e.target.value)} />
        <button type="submit">+ Band</button>
      </form>
      <div className="book-form__actions">
        <button className="primary" disabled={saving || volumes.length < 2} onClick={save}>
          {saving ? 'Speichere...' : 'Reihenfolge speichern'}
        </button>{' '}
        <button type="button" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  );
}

// Serien im Admin: which books belong together and in which order
export default function AdminSeries() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  function load() {
    return api.get('/admin/series').then(setList).catch(err => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function saved() {
    setEditing(null);
    setNotice('Gespeichert');
    load();
  }

  function removeVolume(v) {
    if (!window.confirm('"' + v.title + '" aus der Serie nehmen?')) return;
    api.del('/admin/series/' + encodeURIComponent(v.isbn))
      .then(() => load())
      .catch(err => setError(err.message));
  }

  const shown = list.filter(s => !filter || (s.name + ' ' + (s.author || '')).toLowerCase().indexOf(filter.toLowerCase()) !== -1);

  return (
    <AdminOnly>
      <div className="admin-tabs">
        <input placeholder="Serie oder Autor" value={filter} onChange={e => setFilter(e.target.value)} />
        <span className="admin-count">&nbsp;{shown.length} Serien</span>
        <button className="admin-tabs__job" onClick={() => { setNotice(null); setEditing('new'); }}>+ Neue Serie</button>
      </div>
      {error && <div className="error">{error}</div>}
      {notice && <div className="books-admin__notice">{notice}</div>}
      {editing && (
        <SeriesEditor
          key={editing === 'new' ? 'new' : editing.name}
          initial={editing === 'new' ? null : editing}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      )}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Serie</th>
            <th>Autor</th>
            <th>Bände</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map(s => (
            <tr key={s.name + s.volumes[0].isbn}>
              <td>
                {s.name}
                {s.loop && <span className="series-editor__warn"> Schleife!</span>}
              </td>
              <td>{s.author}</td>
              <td>
                <ol className="series-editor__volumes">
                  {s.volumes.map(v => (
                    <li key={v.isbn}>
                      <Link to={'/books/' + encodeURIComponent(v.isbn)}>{v.title}</Link>{' '}
                      <button className="link-button" title="aus der Serie nehmen" onClick={() => removeVolume(v)}>×</button>
                    </li>
                  ))}
                </ol>
              </td>
              <td><button onClick={() => { setNotice(null); setEditing(s); }}>bearbeiten</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminOnly>
  );
}
