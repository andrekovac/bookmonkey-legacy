import React, { useState } from 'react';

const LOCATIONS = ['', 'Hamburg', 'Berlin', 'München'];

function firstOfYear() {
  return new Date().getFullYear() + '-01-01';
}

function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function url(path, params) {
  const qs = new URLSearchParams();
  Object.keys(params).forEach(k => {
    if (params[k]) qs.append(k, params[k]);
  });
  const s = qs.toString();
  return '/api/v1' + path + (s ? '?' + s : '');
}

// Export v2: loans for a time range, reviews (all or only the bad ones)
export default function ExportBox() {
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(todayIso());
  const [location, setLocation] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyBad, setOnlyBad] = useState(false);

  return (
    <div className="admin-box c-export">
      <h3>Export (CSV)</h3>
      <div className="c-export__row">
        <label>von <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>bis <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <select value={location} onChange={e => setLocation(e.target.value)}>
          {LOCATIONS.map(l => <option key={l} value={l}>{l || 'alle Standorte'}</option>)}
        </select>
        <label><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> nur offene</label>
        <a className="primary c-export__link" href={url('/admin/export/loans.csv', { from, to, location, open: onlyOpen ? '1' : '' })} download>
          Ausleihen
        </a>
      </div>
      <div className="c-export__row">
        <label><input type="checkbox" checked={onlyBad} onChange={e => setOnlyBad(e.target.checked)} /> nur 1 und 2 Sterne</label>
        <a className="primary c-export__link" href={url('/admin/export/reviews.csv', { max: onlyBad ? '2' : '' })} download>
          Rezensionen
        </a>
      </div>
    </div>
  );
}
