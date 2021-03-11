import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Catalogue from './pages/Catalogue.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Catalogue />} />
    </Routes>
  );
}
