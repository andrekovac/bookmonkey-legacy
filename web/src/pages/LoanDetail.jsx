import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate } from '../utils/format';
import '../styles/library.css';

// one loan, linked from the reminder e-mails ("Details: /loans/42")
export default function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/v1/loans/' + id, { credentials: 'include' })
      .then(res => res.json().then(json => ({ status: res.status, json: json })))
      .then(({ status, json }) => {
        if (status === 401) return setError('Bitte zuerst anmelden.');
        if (status !== 200) return setError(json.message || json.error);
        setLoan(json);
      })
      .catch(err => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div>
        <div className="error">{error}</div>
        <Link to="/loans">Zu meinen Ausleihen</Link>
      </div>
    );
  }
  if (!loan) return <div className="loading">Lade...</div>;

  return (
    <div className="loan-detail">
      <Link to="/loans">&laquo; Meine Ausleihen</Link>
      <div className="loan-detail__main">
        <img className="loan-detail__cover" src={loan.cover} alt={loan.title} />
        <div>
          <h1>{loan.title}</h1>
          <div>{loan.author}</div>
          <table className="detail-facts">
            <tbody>
              <tr><th>Exemplar</th><td>{loan.barcode} ({loan.location})</td></tr>
              <tr><th>Ausgeliehen von</th><td>{loan.user_name || loan.email}</td></tr>
              <tr><th>Ausgeliehen am</th><td>{formatDate(loan.borrowed_at)}</td></tr>
              <tr><th>Rückgabe bis</th><td>{formatDate(loan.due_at)}{loan.overdue && <strong className="due--late"> (überfällig)</strong>}</td></tr>
              <tr><th>Verlängert</th><td>{loan.renewals} mal</td></tr>
              <tr><th>Zurückgegeben</th><td>{loan.returned_at ? formatDate(loan.returned_at) : '-'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
