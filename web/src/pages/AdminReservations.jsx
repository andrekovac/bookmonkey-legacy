import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import xhr from '../api/xhr';
import AdminOnly from '../components/AdminOnly.jsx';
import { formatDate } from '../utils/format';

const STATUS = {
  waiting: 'wartet',
  ready: 'Abholregal',
  fulfilled: 'ausgeliehen',
  cancelled: 'storniert',
  expired: 'abgelaufen'
};

// group the flat list by book: { 'Atomic Habits': [r1, r2, ...] }
function byBook(rows) {
  const groups = [];
  const index = {};
  rows.forEach(r => {
    if (index[r.book_id] === undefined) {
      index[r.book_id] = groups.length;
      groups.push({ book_id: r.book_id, isbn: r.isbn, title: r.title, items: [] });
    }
    groups[index[r.book_id]].items.push(r);
  });
  return groups;
}

export default function AdminReservations() {
  const [status, setStatus] = useState('waiting');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  function load() {
    xhr.get('/admin/reservations' + xhr.query({ status: status }), (err, data) => {
      if (err) return setError(err.message);
      setError(null);
      setRows(data);
    });
  }

  useEffect(() => {
    load();
  }, [status]);

  function cancel(r) {
    if (!window.confirm('Vormerkung von ' + (r.user_name || r.email) + ' für "' + r.title + '" stornieren?')) return;
    xhr.del('/reservations/' + r.id, (err) => {
      if (err) return setError(err.message);
      load();
    });
  }

  const groups = byBook(rows);

  return (
    <AdminOnly>
      <h1>Vormerkungen</h1>
      {error && <div className="error">{error}</div>}
      <div className="admin-tabs">
        {Object.keys(STATUS).map(s => (
          <button key={s} className={status === s ? 'admin-tabs__tab admin-tabs__tab--active' : 'admin-tabs__tab'} onClick={() => setStatus(s)}>
            {STATUS[s]}
          </button>
        ))}
        <span className="admin-count admin-tabs__search">{rows.length} Vormerkungen, {groups.length} Bücher</span>
      </div>
      {groups.length === 0 && <div className="empty">Keine Vormerkungen.</div>}
      {groups.map(g => (
        <div key={g.book_id} className="admin-box">
          <h3><Link to={'/books/' + g.isbn}>{g.title}</Link> <span className="admin-table__sub">{g.isbn}</span></h3>
          <table className="admin-table">
            <tbody>
              {g.items.map(r => (
                <tr key={r.id}>
                  <td>{r.position ? r.position + '.' : ''}</td>
                  <td>{r.user_name}<div className="admin-table__sub">{r.email}</div></td>
                  <td>vorgemerkt {formatDate(r.created_at)} {r.created_at.slice(11, 16)}</td>
                  <td>
                    {r.status === 'ready' && <span>{r.barcode} bis {r.expires_at.slice(0, 16)}</span>}
                    {r.status !== 'ready' && r.status !== 'waiting' && <span>{STATUS[r.status]} {formatDate(r.closed_at)}</span>}
                  </td>
                  <td>
                    {(r.status === 'waiting' || r.status === 'ready') && (
                      <button className="link-button" onClick={() => cancel(r)}>stornieren</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </AdminOnly>
  );
}
