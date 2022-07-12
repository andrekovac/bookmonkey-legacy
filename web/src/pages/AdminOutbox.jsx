import React, { useEffect, useState } from 'react';
import AdminOnly from '../components/AdminOnly.jsx';

// what the API "sent" (outbox table). The mail relay sets status to sent.
export default function AdminOutbox() {
  const [mails, setMails] = useState([]);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/v1/admin/outbox' + (status ? '?status=' + status : ''), { credentials: 'include' })
      .then(res => res.json())
      .then(json => {
        if (!Array.isArray(json)) return setError(json.error || json.message);
        setMails(json);
      })
      .catch(err => setError(err.message));
  }, [status]);

  return (
    <AdminOnly>
      <h1>Mails</h1>
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">alle</option>
          <option value="pending">noch nicht verschickt</option>
          <option value="sent">verschickt</option>
          <option value="failed">fehlgeschlagen</option>
        </select>
        <span className="admin-count">{mails.length} Mails</span>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Zeit</th>
            <th>An</th>
            <th>Art</th>
            <th>Betreff</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {mails.map(m => (
            <React.Fragment key={m.id}>
              <tr className="admin-table__row--click" onClick={() => setOpen(open === m.id ? null : m.id)}>
                <td>{m.created_at}</td>
                <td>{m.to_email}</td>
                <td className="mono">{m.kind}</td>
                <td>{m.subject}</td>
                <td>{m.status}{m.sent_at ? ' ' + m.sent_at.slice(11, 16) : ''}</td>
              </tr>
              {open === m.id && (
                <tr>
                  <td colSpan="5"><pre className="admin-mail">{m.body}</pre></td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </AdminOnly>
  );
}
