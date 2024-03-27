import React from 'react';
import { NavLink } from 'react-router-dom';

export default function AdminNav() {
  return (
    <nav className="admin-nav">
      <NavLink to="/admin/loans">Ausleihen</NavLink>
      <NavLink to="/admin/reservations">Vormerkungen</NavLink>
      <NavLink to="/admin/lookup">ISBN</NavLink>
      <NavLink to="/admin/books">Bücher</NavLink>
      <NavLink to="/admin/series">Serien</NavLink>
      <NavLink to="/admin/copies">Exemplare</NavLink>
      <NavLink to="/admin/acquisition">Neuanschaffung</NavLink>
      <NavLink to="/admin/inventory">Inventur</NavLink>
      <NavLink to="/admin/users">Nutzer</NavLink>
      <NavLink to="/admin/discounts">Rabatte</NavLink>
      <NavLink to="/admin/outbox">Mails</NavLink>
      <NavLink to="/admin/flags">Flags</NavLink>
      <a href="/admin-old/" target="_blank" rel="noopener">Bücher (altes Admin)</a>
    </nav>
  );
}
