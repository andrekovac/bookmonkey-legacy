import React, { useEffect, useState } from 'react';
import api from '../api/client';
import AdminOnly from '../components/AdminOnly.jsx';
import { reloadFlags } from '../hooks/useFlags';
import { formatDate } from '../utils/format';

const SOURCES = {
  default: 'default (code)',
  db: 'set here',
  env: 'environment, cannot be changed here'
};

// Feature flags. English only, this page is for the dev team and the library leads.
export default function AdminFlags() {
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  function load() {
    return api.get('/admin/flags').then(setList).catch(err => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(flag) {
    setBusy(flag.name);
    setError(null);
    api.put('/admin/flags/' + encodeURIComponent(flag.name), { enabled: !flag.enabled })
      .then(() => load())
      .then(() => reloadFlags())
      .catch(err => setError(err.message))
      .finally(() => setBusy(null));
  }

  return (
    <AdminOnly>
      <h1>Feature flags</h1>
      <p className="admin-count">Changes are live for everybody after a few seconds (the API caches flags for 5 s). Reload the page to see it yourself.</p>
      {error && <div className="error">{error}</div>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Flag</th>
            <th>Description</th>
            <th>Source</th>
            <th>Last change</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(f => (
            <tr key={f.name}>
              <td className="mono">{f.name}</td>
              <td>{f.description}</td>
              <td>{SOURCES[f.source] || f.source}</td>
              <td>{f.updatedAt ? formatDate(f.updatedAt) : '-'}</td>
              <td>
                <label className="c-switch">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    disabled={f.source === 'env' || busy === f.name}
                    onChange={() => toggle(f)}
                  />
                  <span className="c-switch__label">{f.enabled ? 'on' : 'off'}</span>
                </label>
              </td>
            </tr>
          ))}
          {!list.length && (
            <tr><td colSpan="5" className="admin-count">No flags.</td></tr>
          )}
        </tbody>
      </table>
    </AdminOnly>
  );
}
