import React, { useEffect, useState } from 'react';
import xhr from '../api/xhr';
import AdminOnly from '../components/AdminOnly.jsx';
import { formatDate } from '../utils/format';

const STATUS = {
  available: 'im Regal',
  on_loan: 'ausgeliehen',
  on_hold: 'Abholregal',
  repair: 'Reparatur',
  lost: 'verloren'
};
const LOCATIONS = ['Hamburg', 'Berlin', 'München'];

function CopiesTable({ copies, onChange, onDelete }) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Barcode</th>
          <th>Buch</th>
          <th>Standort</th>
          <th>Regal</th>
          <th>Status</th>
          <th>Notiz</th>
          <th>seit</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {copies.map(c => (
          <tr key={c.id} className={'admin-table__row admin-table__row--' + c.status}>
            <td className="mono">{c.barcode}</td>
            <td>{c.title}<div className="admin-table__sub">{c.isbn}</div></td>
            <td>
              <select value={c.location} onChange={e => onChange(c, { location: e.target.value })}>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </td>
            <td>{c.shelf}</td>
            <td>
              {/* on_loan / on_hold are set by the loans, not by hand */}
              {c.status === 'on_loan' || c.status === 'on_hold' ? (
                STATUS[c.status]
              ) : (
                <select value={c.status} onChange={e => onChange(c, { status: e.target.value })}>
                  <option value="available">{STATUS.available}</option>
                  <option value="repair">{STATUS.repair}</option>
                  <option value="lost">{STATUS.lost}</option>
                </select>
              )}
            </td>
            <td>
              <input
                className="admin-table__note"
                defaultValue={c.note || ''}
                onBlur={e => { if ((c.note || '') !== e.target.value) onChange(c, { note: e.target.value }); }}
              />
            </td>
            <td>{formatDate(c.updated_at)}</td>
            <td>
              {c.status !== 'on_loan' && c.status !== 'on_hold' && (
                <button className="link-button" onClick={() => onDelete(c)}>entfernen</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminCopies() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [copies, setCopies] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [add, setAdd] = useState({ isbn: '', location: 'Hamburg', count: 1, shelf: '' });

  function load() {
    xhr.get('/admin/copies' + xhr.query({ q: q, status: status, location: location }), (err, rows) => {
      if (err) return setError(err.message);
      setError(null);
      setCopies(rows);
    });
  }

  useEffect(() => {
    load();
  }, [status, location]);

  function search(e) {
    e.preventDefault();
    load();
  }

  function change(copy, changes) {
    xhr.put('/admin/copies/' + copy.id, changes, (err, updated) => {
      if (err) return setError(err.message);
      setCopies(copies.map(c => (c.id === copy.id ? Object.assign({}, c, updated) : c)));
      if (changes.status === 'available' && updated.status === 'on_hold') {
        setNotice(copy.barcode + ' geht direkt ins Abholregal (Warteliste).');
      }
    });
  }

  function remove(copy) {
    if (!window.confirm('Exemplar ' + copy.barcode + ' wirklich entfernen? Die Ausleihhistorie geht dabei verloren.')) return;
    xhr.del('/admin/copies/' + copy.id, (err) => {
      if (err) return setError(err.message);
      setCopies(copies.filter(c => c.id !== copy.id));
    });
  }

  function addCopies(e) {
    e.preventDefault();
    if (!add.isbn) return setError('ISBN fehlt');
    xhr.post('/admin/books/' + encodeURIComponent(add.isbn.trim()) + '/copies', add, (err, created) => {
      if (err) return setError(err.message);
      setError(null);
      setNotice(created.length + ' Exemplar(e) angelegt: ' + created.map(c => c.barcode).join(', ') + '. Bitte Etiketten drucken!');
      setAdd(Object.assign({}, add, { isbn: '', count: 1 }));
      load();
    });
  }

  return (
    <AdminOnly>
      <h1>Exemplare</h1>
      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}

      <form className="admin-box" onSubmit={addCopies}>
        <h3>Exemplare hinzufügen</h3>
        <input placeholder="ISBN (mit Bindestrichen)" value={add.isbn} onChange={e => setAdd(Object.assign({}, add, { isbn: e.target.value }))} />
        <select value={add.location} onChange={e => setAdd(Object.assign({}, add, { location: e.target.value }))}>
          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input className="admin-box__small" placeholder="Regal" value={add.shelf} onChange={e => setAdd(Object.assign({}, add, { shelf: e.target.value }))} />
        <input className="admin-box__small" type="number" min="1" max="20" value={add.count} onChange={e => setAdd(Object.assign({}, add, { count: e.target.value }))} />
        <button className="primary" type="submit">Anlegen</button>
      </form>

      <form className="toolbar" onSubmit={search}>
        <input placeholder="Titel oder Barcode" value={q} onChange={e => setQ(e.target.value)} />
        <button type="submit">Suchen</button>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">alle Status</option>
          {Object.keys(STATUS).map(s => <option key={s} value={s}>{STATUS[s]}</option>)}
        </select>
        <select value={location} onChange={e => setLocation(e.target.value)}>
          <option value="">alle Standorte</option>
          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className="admin-count">{copies.length} Exemplare</span>
      </form>

      <CopiesTable copies={copies} onChange={change} onDelete={remove} />
    </AdminOnly>
  );
}
