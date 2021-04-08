import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Catalogue from './pages/Catalogue.jsx';
import Detail from './pages/Detail.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Catalogue />} />
      <Route path="/books/:isbn" element={<Detail />} />
    </Routes>
  );
}
