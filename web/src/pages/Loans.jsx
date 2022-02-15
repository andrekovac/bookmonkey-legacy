import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/format';
import '../styles/library.css';

function dueLabel(loan) {
  if (loan.overdue) return 'überfällig seit ' + Math.abs(loan.daysLeft) + (Math.abs(loan.daysLeft) === 1 ? ' Tag' : ' Tagen');
  if (loan.daysLeft === 0) return 'heute fällig';
  if (loan.daysLeft === 1) return 'morgen fällig';
  return 'noch ' + loan.daysLeft + ' Tage';
}

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const navigate = useNavigate();

  function load() {
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
  }

  useEffect(() => {
    load();
  }, []);

  function action(loan, what) {
    setError(null);
    setNotice(null);
    fetch('/api/v1/loans/' + loan.id + '/' + what, { method: 'POST', credentials: 'include' })
      .then(res => res.json().then(json => ({ ok: res.ok, json: json })))
      .then(({ ok, json }) => {
        if (!ok) {
          setError(json.message || json.error);
          return;
        }
        if (what === 'renew') setNotice('Verlängert bis ' + formatDate(json.due_at) + '.');
        else setNotice('"' + json.title + '" zurückgegeben. Danke!');
        load();
      })
      .catch(err => setError(err.message));
  }

  return (
    <div className="loans">
      <h1>Meine Ausleihen</h1>
      <p className="loans__hint">
        Leihfrist 4 Wochen, du kannst zweimal um 2 Wochen verlängern.
        Zurückgeben kannst du in der Rückgabebox oder hier, wenn das Buch schon im Regal steht.
      </p>
      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Lade...</div>}
      {!loading && loans.length === 0 && (
        <div className="empty">Du hast gerade nichts ausgeliehen. <Link to="/">Zum Katalog</Link></div>
      )}
      {loans.length > 0 && (
        <table className="loans-table">
          <thead>
            <tr>
              <th></th>
              <th>Buch</th>
              <th>Exemplar</th>
              <th>Ausgeliehen</th>
              <th>Rückgabe bis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.map(l => (
              <tr key={l.id} className={l.overdue ? 'loans-table__row--overdue' : ''}>
                <td><img className="loans-table__cover" src={l.cover} alt="" /></td>
                <td>
                  <Link to={'/books/' + l.isbn}>{l.title}</Link>
                  <div className="loans-table__author">{l.author}</div>
                </td>
                <td>
                  <Link to={'/loans/' + l.id}>{l.barcode}</Link>
                  <div className="loans-table__author">{l.location}</div>
                </td>
                <td>{formatDate(l.borrowed_at)}</td>
                <td>
                  {formatDate(l.due_at)}
                  <div className={l.overdue ? 'due due--late' : 'due'}>{dueLabel(l)}</div>
                </td>
                <td className="loans-table__actions">
                  <button onClick={() => action(l, 'renew')} disabled={l.renewals >= 2}>
                    Verlängern{l.renewals > 0 ? ' (' + l.renewals + '/2)' : ''}
                  </button>
                  <button onClick={() => action(l, 'return')}>Zurückgeben</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p><Link to="/account">Ausleihhistorie im Konto</Link></p>
    </div>
  );
}
