import React, { useEffect, useState } from 'react';

// "Verfügbar in Hamburg (1 von 2)" box on the detail page
export default function Availability({ isbn }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    fetch('/api/v1/books/' + encodeURIComponent(isbn) + '/availability', { credentials: 'include' })
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => setError(err.message));
  }, [isbn]);

  if (error) return null;
  if (!data) return <div className="availability availability--loading">Verfügbarkeit wird geladen...</div>;
  if (data.total === 0) {
    return <div className="availability availability--none">Nicht in der Bibliothek, nur im Shop erhältlich.</div>;
  }

  return (
    <div className="availability">
      <div className="availability__summary">
        {data.available > 0
          ? <strong className="availability__ok">Verfügbar</strong>
          : <strong className="availability__out">Alle Exemplare ausgeliehen</strong>}
        {' '}({data.available} von {data.total})
      </div>
      <ul className="availability__locations">
        {data.locations.map(l => (
          <li key={l.location}>{l.location}: {l.available} / {l.total}</li>
        ))}
      </ul>
    </div>
  );
}
