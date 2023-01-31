import React, { useState } from 'react';
import AdminOnly from '../components/AdminOnly.jsx';

const LOCATIONS = ['Hamburg', 'Berlin', 'München'];

function CopyList({ title, copies, hint, className }) {
  if (!copies || copies.length === 0) return null;
  return (
    <div className={'inventory-list ' + (className || '')}>
      <h3>{title} ({copies.length})</h3>
      {hint && <p className="admin-table__sub">{hint}</p>}
      <ul>
        {copies.map(c => (
          <li key={c.barcode || c}>
            {typeof c === 'string' ? <span className="mono">{c}</span> : (
              <span><span className="mono">{c.barcode}</span> {c.title} {c.shelf ? '(' + c.shelf + ')' : ''}{c.location ? ' - ' + c.location : ''}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Inventur: scan all barcodes of one location into the text field (the scanner sends Enter
// after each code), then "Prüfen". "Übernehmen" marks the missing ones as lost.
export default function AdminInventory() {
  const [location, setLocation] = useState('Hamburg');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const barcodes = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

  function send(mode) {
    if (!barcodes.length) return setError('Noch nichts gescannt.');
    if (mode === 'apply' && !window.confirm(result.missing.length + ' Exemplare als verloren markieren?')) return;
    setBusy(true);
    setError(null);
    fetch('/api/v1/admin/inventory/' + mode, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: location, barcodes: barcodes })
    })
      .then(res => res.json().then(json => ({ ok: res.ok, json: json })))
      .then(({ ok, json }) => {
        setBusy(false);
        if (!ok) return setError(json.message || json.error);
        setResult(json);
      })
      .catch(err => {
        setBusy(false);
        setError(err.message);
      });
  }

  return (
    <AdminOnly>
      <h1>Inventur</h1>
      {error && <div className="error">{error}</div>}
      <div className="admin-row">
        <div className="admin-box inventory-scan">
          <h3>Barcodes scannen</h3>
          <select value={location} onChange={e => { setLocation(e.target.value); setResult(null); }}>
            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
          <textarea
            rows="14"
            value={text}
            placeholder="BM-00001&#10;BM-00002&#10;..."
            onChange={e => { setText(e.target.value); setResult(null); }}
          />
          <div className="admin-table__sub">{barcodes.length} gescannt</div>
          <button onClick={() => send('check')} disabled={busy}>Prüfen</button>{' '}
          {result && !result.applied && result.missing.length + result.lost.length > 0 && (
            <button className="primary" onClick={() => send('apply')} disabled={busy}>Übernehmen</button>
          )}
        </div>
        {result && (
          <div className="inventory-result">
            {result.applied && <div className="success">Übernommen.</div>}
            <p>{result.found.length} von {result.scanned} gescannten Exemplaren sind in Ordnung.</p>
            <CopyList title="Fehlen" className="inventory-list--bad" copies={result.missing}
              hint={result.applied ? 'wurden als verloren markiert' : 'werden beim Übernehmen als verloren markiert'} />
            <CopyList title="Laut System ausgeliehen" copies={result.onLoan}
              hint="Rückgabe wurde nicht gebucht, bitte an der Theke zurückbuchen" />
            <CopyList title="Wieder gefunden" className="inventory-list--good" copies={result.lost} />
            <CopyList title="Anderer Standort" copies={result.elsewhere} />
            <CopyList title="Unbekannte Barcodes" copies={result.unknown} hint="altes Etikett? Exemplar neu anlegen" />
          </div>
        )}
      </div>
    </AdminOnly>
  );
}
