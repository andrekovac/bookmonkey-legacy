import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as session from '../session';
import AdminNav from './AdminNav.jsx';
import '../styles/admin.css';

// wraps the admin pages. The API checks the role too, this is only so nobody sees an empty page.
export default function AdminOnly({ children }) {
  const [user, setUser] = useState(session.getUser());
  const [loaded, setLoaded] = useState(session.isLoaded());

  useEffect(() => {
    return session.subscribe(u => {
      setUser(u);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <div className="loading">Lade...</div>;
  if (!user) {
    return <div className="error">Bitte <Link to={'/login?next=' + encodeURIComponent(window.location.pathname)}>anmelden</Link>.</div>;
  }
  if (user.role !== 'admin') return <div className="error">Nur für das Bibliotheksteam.</div>;
  return (
    <div className="admin">
      <AdminNav />
      {children}
    </div>
  );
}
