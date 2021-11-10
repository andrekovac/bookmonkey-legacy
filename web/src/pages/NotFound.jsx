import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>Seite nicht gefunden</h1>
      <p>
        Diese Seite gibt es nicht (mehr). <Link to="/">Zum Katalog</Link>
      </p>
    </div>
  );
}
