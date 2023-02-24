import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminOnly from '../components/AdminOnly.jsx';
import * as session from '../session';
import { formatDate } from '../utils/format';

function put(url, body) {
  return fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(res => res.json().then(json => {
    if (!res.ok) throw new Error(json.message || json.error);
    return json;
  }));
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [open, setOpen] = useState(null);
  const [loans, setLoans] = useState([]);
  const [error, setError] = useState(null);
  const me = session.getUser();

  function load() {
    fetch('/api/v1/admin/users', { credentials: 'include' })
      .then(res => res.json())
      .then(json => {
        if (!Array.isArray(json)) return setError(json.message || json.error);
        setUsers(json);
      })
      .catch(err => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(user) {
    if (open === user.id) return setOpen(null);
    setOpen(user.id);
    setLoans([]);
    fetch('/api/v1/admin/loans?q=' + encodeURIComponent(user.email), { credentials: 'include' })
      .then(res => res.json())
      .then(json => setLoans(Array.isArray(json) ? json : []))
      .catch(err => setError(err.message));
  }

  function change(user, changes) {
    setError(null);
    put('/api/v1/admin/users/' + user.id, changes)
      .then(() => load())
      .catch(err => setError(err.message));
  }

  const shown = users.filter(u => {
    if (onlyOverdue && !u.overdue_loans) return false;
    if (!q) return true;
    const hay = ((u.name || '') + ' ' + u.email + ' ' + (u.department || '')).toLowerCase();
    return hay.indexOf(q.toLowerCase()) !== -1;
  });

  return (
    <AdminOnly>
      <h1>Nutzer</h1>
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <input placeholder="Name, E-Mail, Abteilung" value={q} onChange={e => setQ(e.target.value)} />
        <label className="toolbar-check">
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} /> nur mit überfälligen
        </label>
        <span className="admin-count">{shown.length} Nutzer</span>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Abteilung</th>
            <th>Bibliothek</th>
            <th>Rolle</th>
            <th>Ausleihen</th>
            <th>Vormerkungen</th>
            <th>seit</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(u => (
            <React.Fragment key={u.id}>
              <tr className={u.overdue_loans ? 'admin-table__row--late' : ''}>
                <td>
                  <button className="link-button" onClick={() => toggle(u)}>{u.name || '(kein Name)'}</button>
                  <div className="admin-table__sub">{u.email}</div>
                </td>
                <td>{u.department}</td>
                <td>
                  <select value={u.location || ''} onChange={e => change(u, { location: e.target.value })}>
                    <option value="">-</option>
                    <option>Hamburg</option>
                    <option>Berlin</option>
                    <option>München</option>
                  </select>
                </td>
                <td>
                  <select value={u.role} disabled={me && me.id === u.id} onChange={e => change(u, { role: e.target.value })}>
                    <option value="customer">Mitarbeiter/Kunde</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  {u.open_loans} offen{u.overdue_loans > 0 && <strong className="due--late">, {u.overdue_loans} überfällig</strong>}
                  <div className="admin-table__sub">{u.all_loans} insgesamt</div>
                </td>
                <td>{u.reservations || ''}</td>
                <td>{formatDate(u.created_at)}</td>
              </tr>
              {open === u.id && (
                <tr>
                  <td colSpan="7">
                    {loans.length === 0 && <div className="admin-table__sub">keine Ausleihen</div>}
                    <ul>
                      {loans.map(l => (
                        <li key={l.id}>
                          <Link to={'/loans/' + l.id}>{l.title}</Link> ({l.barcode}),{' '}
                          {l.returned_at ? 'zurück am ' + formatDate(l.returned_at) : 'fällig ' + formatDate(l.due_at)}
                          {l.overdue && <strong className="due--late"> überfällig</strong>}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </AdminOnly>
  );
}
