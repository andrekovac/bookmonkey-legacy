import React from 'react';
import { NavLink } from 'react-router-dom';

export default function AdminNav() {
  return (
    <nav className="admin-nav">
      <NavLink to="/admin/loans">Ausleihen</NavLink>
      <NavLink to="/admin/copies">Exemplare</NavLink>
      <NavLink to="/admin/acquisition">Neuanschaffung</NavLink>
      <NavLink to="/admin/discounts">Rabatte</NavLink>
      <NavLink to="/admin/outbox">Mails</NavLink>
      <a href="/admin-old/" target="_blank" rel="noopener">Bücher (altes Admin)</a>
    </nav>
  );
}
