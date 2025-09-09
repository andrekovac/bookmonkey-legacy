import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AdminOnly from '../components/AdminOnly.jsx';
import useDebounce from '../hooks/useDebounce';

const ENTITIES = {
  '': 'alles',
  book: 'Bücher',
  copy: 'Exemplare',
  user: 'Nutzer',
  discount: 'Rabatte',
  flag: 'Flags'
};

const ACTIONS = {
  create: 'angelegt',
  update: 'geändert',
  delete: 'gelöscht'
};

// { price: [12.99, 13.99] } -> "price: 12.99 → 13.99", { fields: [...] } -> "title, price"
function describe(details) {
  if (!details) return '';
  if (Array.isArray(details.fields)) return details.fields.join(', ');
  return Object.keys(details).map(k => {
    const v = details[k];
    if (Array.isArray(v) && v.length === 2) return k + ': ' + (v[0] === null ? '-' : v[0]) + ' → ' + (v[1] === null ? '-' : v[1]);
    return k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v);
  }).join(' · ');
}

function target(row) {
  if (row.entity === 'book' && row.action !== 'delete') return <Link to={'/books/' + row.entity_id}>{row.entity_id}</Link>;
  return <span className="mono">{row.entity_id}</span>;
}

// Änderungsprotokoll (2025)
export default function AdminAudit() {
  const [entity, setEntity] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function load(nextQ) {
    setLoading(true);
    api.get('/admin/audit', { query: { entity: entity || undefined, q: nextQ || undefined } })
      .then(list => {
        setError(null);
        setRows(list);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  const loadLater = useDebounce(load, 300);

  useEffect(() => {
    load(q);
  }, [entity]);

  function onType(e) {
    setQ(e.target.value);
    loadLater(e.target.value);
  }

  return (
    <AdminOnly>
      <h1>Änderungsprotokoll</h1>
      {error && <div className="error">{error}</div>}
      <div className="admin-tabs">
        {Object.keys(ENTITIES).map(k => (
          <button key={k} className={entity === k ? 'admin-tabs__tab admin-tabs__tab--active' : 'admin-tabs__tab'} onClick={() => setEntity(k)}>
            {ENTITIES[k]}
          </button>
        ))}
        <input className="admin-tabs__search" placeholder="ISBN, Barcode, E-Mail..." value={q} onChange={onType} />
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Zeit</th>
            <th>Wer</th>
            <th>Was</th>
            <th></th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="mono">{r.created_at.slice(0, 16)}</td>
              <td>{r.user_name || r.email || <span className="admin-table__sub">unbekannt</span>}</td>
              <td>{(ENTITIES[r.entity] || r.entity) + ' ' + (ACTIONS[r.action] || r.action)}</td>
              <td>{target(r)}</td>
              <td className="admin-table__sub">{describe(r.details)}</td>
            </tr>
          ))}
          {!rows.length && !loading && (
            <tr><td colSpan="5" className="admin-count">Noch keine Änderungen.</td></tr>
          )}
        </tbody>
      </table>
    </AdminOnly>
  );
}
