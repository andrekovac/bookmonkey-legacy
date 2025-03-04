import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminOnly from '../components/AdminOnly.jsx';
import { formatDate } from '../utils/format';

const TABS = [
  { key: 'open', label: 'Offen' },
  { key: 'overdue', label: 'Überfällig' },
  { key: 'returned', label: 'Zurück' }
];

function post(url, body) {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  }).then(res => res.json().then(json => {
    if (!res.ok) throw new Error(json.message || json.error || 'Fehler ' + res.status);
    return json;
  }));
}

export default function AdminLoans() {
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState({ email: '', barcode: '' });

  function load() {
    const params = new URLSearchParams({ status: tab });
    if (q) params.set('q', q);
    fetch('/api/v1/admin/loans?' + params.toString(), { credentials: 'include' })
      .then(res => res.json())
      .then(json => {
        if (!Array.isArray(json)) return setError(json.error || json.message);
        setRows(json);
      })
      .catch(err => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [tab]);

  function doCheckin(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    post('/api/v1/admin/loans/checkin', { barcode: checkin })
      .then(json => {
        let msg = json.copy.barcode + ' "' + json.loan.title + '" zurück von ' + (json.loan.user_name || json.loan.email) + '.';
        if (json.loan.overdue) msg += ' War überfällig!';
        if (json.hold) msg += ' -> ABHOLREGAL für ' + (json.hold.name || json.hold.email);
        else msg += ' -> zurück ins Regal ' + (json.copy.shelf || '') + ' (' + json.copy.location + ')';
        setNotice(msg);
        setCheckin('');
        load();
      })
      .catch(err => setError(err.message));
  }

  function doCheckout(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    post('/api/v1/admin/loans', checkout)
      .then(json => {
        setNotice(json.barcode + ' an ' + (json.user_name || json.email) + ' ausgeliehen, zurück bis ' + formatDate(json.due_at) + '.');
        setCheckout({ email: checkout.email, barcode: '' });
        load();
      })
      .catch(err => setError(err.message));
  }

  function runJob() {
    post('/api/v1/admin/jobs/overdue')
      .then(json => setNotice('Mahnlauf: ' + json.dueSoon + ' bald fällig, ' + json.reminders + ' Erinnerungen, ' + json.expiredHolds + ' Abholfristen abgelaufen.'))
      .catch(err => setError(err.message));
  }

  function sendSummary() {
    post('/api/v1/admin/jobs/overdue-summary')
      .then(json => setNotice(json.admins ? 'Wochenübersicht an ' + json.admins + ' Admins verschickt (siehe Mails).' : 'Nichts überfällig, keine Übersicht verschickt.'))
      .catch(err => setError(err.message));
  }

  return (
    <AdminOnly>
      <h1>Ausleihen</h1>
      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}

      <div className="admin-row">
        <form className="admin-box" onSubmit={doCheckin}>
          <h3>Rückgabe</h3>
          <input autoFocus placeholder="Barcode scannen" value={checkin} onChange={e => setCheckin(e.target.value)} />
          <button className="primary" type="submit">Zurückbuchen</button>
        </form>
        <form className="admin-box" onSubmit={doCheckout}>
          <h3>Ausleihe an der Theke</h3>
          <input placeholder="E-Mail" value={checkout.email} onChange={e => setCheckout(Object.assign({}, checkout, { email: e.target.value }))} />
          <input placeholder="Barcode" value={checkout.barcode} onChange={e => setCheckout(Object.assign({}, checkout, { barcode: e.target.value }))} />
          <button className="primary" type="submit">Ausleihen</button>
        </form>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'admin-tabs__tab admin-tabs__tab--active' : 'admin-tabs__tab'} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <form className="admin-tabs__search" onSubmit={e => { e.preventDefault(); load(); }}>
          <input placeholder="Titel, Name, E-Mail, Barcode" value={q} onChange={e => setQ(e.target.value)} />
        </form>
        <button className="admin-tabs__job" onClick={runJob}>Mahnlauf jetzt</button>
        <button className="admin-tabs__job" onClick={sendSummary} title="geht sonst jeden Montag automatisch raus">Wochenübersicht</button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Buch</th>
            <th>Barcode</th>
            <th>Person</th>
            <th>Ausgeliehen</th>
            <th>Fällig</th>
            <th>Erinnerungen</th>
            <th>Zurück</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(l => (
            <tr key={l.id} className={l.overdue ? 'admin-table__row--late' : ''}>
              <td><Link to={'/loans/' + l.id}>{l.id}</Link></td>
              <td><Link to={'/books/' + l.isbn}>{l.title}</Link></td>
              <td className="mono">{l.barcode}<div className="admin-table__sub">{l.location}</div></td>
              <td>{l.user_name}<div className="admin-table__sub">{l.email}</div></td>
              <td>{formatDate(l.borrowed_at)}</td>
              <td>{formatDate(l.due_at)}{l.overdue && <div className="due--late">{-l.daysLeft} Tage</div>}</td>
              <td>{l.reminder_count || ''}</td>
              <td>{l.returned_at ? formatDate(l.returned_at) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">Nichts gefunden.</div>}
    </AdminOnly>
  );
}
