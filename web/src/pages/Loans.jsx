import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/format';
import '../styles/library.css';

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/v1/loans', { credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          navigate('/login?next=/loans');
          return null;
        }
        return res.json();
      })
      .then(json => {
        if (!json) return;
        setLoans(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // TODO renew + return buttons
  return (
    <div className="loans">
      <h1>Meine Ausleihen</h1>
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Lade...</div>}
      {!loading && loans.length === 0 && (
        <div className="empty">Du hast gerade nichts ausgeliehen. <Link to="/">Zum Katalog</Link></div>
      )}
      <table className="loans-table">
        <tbody>
          {loans.map(l => (
            <tr key={l.id}>
              <td><Link to={'/books/' + l.isbn}>{l.title}</Link></td>
              <td>{l.barcode}</td>
              <td>{formatDate(l.due_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
