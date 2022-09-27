import React, { useEffect, useState } from 'react';
import xhr from '../api/xhr';
import AdminOnly from '../components/AdminOnly.jsx';
import { formatDate } from '../utils/format';

const SCOPES = {
  all: 'alle Bücher',
  publisher: 'Verlag',
  author: 'Autor',
  isbn: 'einzelnes Buch (ISBN)'
};

const EMPTY = { name: '', scope: 'publisher', value: '', percent: '', valid_from: '', valid_until: '', active: true };

function RuleForm({ initial, publishers, onSave, onCancel }) {
  const [rule, setRule] = useState(initial);

  function set(field, value) {
    setRule(Object.assign({}, rule, { [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    onSave(rule);
  }

  return (
    <form className="admin-box discount-form" onSubmit={submit}>
      <h3>{rule.id ? 'Regel bearbeiten' : 'Neue Rabattregel'}</h3>
      <div className="form-row">
        <label>Name<input value={rule.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Herbstaktion" /></label>
        <label>Rabatt %<input value={rule.percent} onChange={e => set('percent', e.target.value)} placeholder="10" /></label>
      </div>
      <div className="form-row">
        <label>
          Gilt für
          <select value={rule.scope} onChange={e => set('scope', e.target.value)}>
            {Object.keys(SCOPES).map(s => <option key={s} value={s}>{SCOPES[s]}</option>)}
          </select>
        </label>
        {rule.scope === 'publisher' && (
          <label>
            Verlag
            <select value={rule.value || ''} onChange={e => set('value', e.target.value)}>
              <option value="">bitte wählen</option>
              {publishers.map(p => <option key={p.publisher} value={p.publisher}>{p.publisher} ({p.count})</option>)}
            </select>
          </label>
        )}
        {(rule.scope === 'author' || rule.scope === 'isbn') && (
          <label>
            {rule.scope === 'author' ? 'Autor (genau wie im Katalog)' : 'ISBN'}
            <input value={rule.value || ''} onChange={e => set('value', e.target.value)} />
          </label>
        )}
      </div>
      <div className="form-row">
        <label>von<input type="date" value={rule.valid_from || ''} onChange={e => set('valid_from', e.target.value)} /></label>
        <label>bis<input type="date" value={rule.valid_until || ''} onChange={e => set('valid_until', e.target.value)} /></label>
        <label className="discount-form__check">
          <input type="checkbox" checked={!!rule.active} onChange={e => set('active', e.target.checked)} /> aktiv
        </label>
      </div>
      <button className="primary" type="submit">Speichern</button>{' '}
      {onCancel && <button type="button" onClick={onCancel}>Abbrechen</button>}
    </form>
  );
}

function isRunning(rule) {
  const today = new Date().toISOString().slice(0, 10);
  if (!rule.active) return false;
  if (rule.valid_from && rule.valid_from > today) return false;
  if (rule.valid_until && rule.valid_until < today) return false;
  return true;
}

export default function AdminDiscounts() {
  const [rules, setRules] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    xhr.get('/admin/discounts', (err, rows) => {
      if (err) return setError(err.message);
      setRules(rows);
    });
  }

  useEffect(() => {
    load();
    xhr.get('/publishers', (err, rows) => {
      if (!err) setPublishers(rows);
    });
  }, []);

  function save(rule) {
    setError(null);
    const body = Object.assign({}, rule);
    delete body.books;
    const done = (err) => {
      if (err) return setError(err.message);
      setEditing(null);
      load();
    };
    if (rule.id) xhr.put('/admin/discounts/' + rule.id, body, done);
    else xhr.post('/admin/discounts', body, done);
  }

  function toggle(rule) {
    xhr.put('/admin/discounts/' + rule.id, { active: !rule.active }, (err) => {
      if (err) return setError(err.message);
      load();
    });
  }

  function remove(rule) {
    if (!window.confirm('Regel "' + rule.name + '" löschen?')) return;
    xhr.del('/admin/discounts/' + rule.id, (err) => {
      if (err) return setError(err.message);
      load();
    });
  }

  return (
    <AdminOnly>
      <h1>Rabatte</h1>
      <p className="loans__hint">Gilt nur für den Shop (Kaufen), nicht für die Ausleihe. Wenn mehrere Regeln passen, zählt die höchste.</p>
      {error && <div className="error">{error}</div>}
      {editing ? (
        <RuleForm initial={editing} publishers={publishers} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <button className="primary" onClick={() => setEditing(EMPTY)}>Neue Regel</button>
      )}
      <table className="admin-table discount-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Gilt für</th>
            <th>Rabatt</th>
            <th>Zeitraum</th>
            <th>Bücher</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id} className={isRunning(r) ? '' : 'discount-table__row--off'}>
              <td>{r.name}</td>
              <td>{SCOPES[r.scope]}{r.value ? ': ' + r.value : ''}</td>
              <td>{r.percent} %</td>
              <td>{r.valid_from || r.valid_until ? formatDate(r.valid_from) + ' - ' + formatDate(r.valid_until) : 'unbegrenzt'}</td>
              <td>{r.books}</td>
              <td>
                <button className="link-button" onClick={() => toggle(r)}>{r.active ? 'aktiv' : 'aus'}</button>
                {r.active && !isRunning(r) && <div className="admin-table__sub">außerhalb Zeitraum</div>}
              </td>
              <td>
                <button className="link-button" onClick={() => setEditing(r)}>bearbeiten</button>{' '}
                <button className="link-button" onClick={() => remove(r)}>löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminOnly>
  );
}
