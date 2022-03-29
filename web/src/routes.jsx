import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Catalogue from './pages/Catalogue.jsx';
import Detail from './pages/Detail.jsx';
import Login from './pages/Login.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Account from './pages/Account.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';
import Loans from './pages/Loans.jsx';
import LoanDetail from './pages/LoanDetail.jsx';
import Reservations from './pages/Reservations.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Catalogue />} />
      <Route path="/books/:isbn" element={<Detail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/account" element={<Account />} />
      <Route path="/register" element={<Register />} />
      <Route path="/loans" element={<Loans />} />
      <Route path="/loans/:id" element={<LoanDetail />} />
      <Route path="/reservations" element={<Reservations />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
