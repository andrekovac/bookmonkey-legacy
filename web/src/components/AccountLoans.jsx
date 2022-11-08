import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../utils/format';

// Ausleihhistorie for the account page (the account page itself is still a class)
export default function AccountLoans() {
  const [loans, setLoans] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/v1/loans?history=1', { credentials: 'include' })
      .then(res => res.json())
      .then(json => {
        if (!Array.isArray(json)) return setError(json.message || json.error);
        setLoans(json);
      })
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!loans) return <div className="loading">Lade...</div>;

  const shown = loans.filter(l => {
    if (filter === 'open') return !l.returned_at;
    if (filter === 'returned') return !!l.returned_at;
    return true;
  });
  const openCount = loans.filter(l => !l.returned_at).length;
  const lateCount = loans.filter(l => l.overdue).length;

  return (
    <div className="account-loans">
      <h2>Ausleihen</h2>
      <p>
        {loans.length} Ausleihen insgesamt, {openCount} offen
        {lateCount > 0 && <strong className="due--late">, {lateCount} überfällig</strong>}.{' '}
        <Link to="/loans">Verlängern / zurückgeben</Link>
      </p>
      <div className="account-loans__filter">
        <label><input type="radio" checked={filter === 'all'} onChange={() => setFilter('all')} /> alle</label>
        <label><input type="radio" checked={filter === 'open'} onChange={() => setFilter('open')} /> offen</label>
        <label><input type="radio" checked={filter === 'returned'} onChange={() => setFilter('returned')} /> zurückgegeben</label>
      </div>
      {shown.length === 0 && <div className="empty">Keine Ausleihen.</div>}
      <table className="cart-table">
        <tbody>
          {shown.map(l => (
            <tr key={l.id} className={l.overdue ? 'loans-table__row--overdue' : ''}>
              <td><Link to={'/books/' + l.isbn}>{l.title}</Link></td>
              <td>{formatDate(l.borrowed_at)}</td>
              <td>{l.returned_at ? 'zurück ' + formatDate(l.returned_at) : 'bis ' + formatDate(l.due_at)}</td>
              <td><Link to={'/loans/' + l.id}>Details</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
