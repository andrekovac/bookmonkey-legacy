import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CatalogueSwitch from './components/CatalogueSwitch.jsx';
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
import AdminCopies from './pages/AdminCopies.jsx';
import AdminLoans from './pages/AdminLoans.jsx';
import AdminOutbox from './pages/AdminOutbox.jsx';
import AdminAcquisition from './pages/AdminAcquisition.jsx';
import AdminDiscounts from './pages/AdminDiscounts.jsx';
import AdminInventory from './pages/AdminInventory.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminReservations from './pages/AdminReservations.jsx';
import AdminBooks from './pages/AdminBooks.jsx';
import ReservationLink from './pages/ReservationLink.jsx';
import AdminSeries from './pages/AdminSeries.jsx';
import AdminLookup from './pages/AdminLookup.jsx';
import Wishlist from './pages/Wishlist.jsx';
import AdminFlags from './pages/AdminFlags.jsx';
import AdminReports from './pages/AdminReports.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CatalogueSwitch />} />
      <Route path="/books/:isbn" element={<Detail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/account" element={<Account />} />
      <Route path="/register" element={<Register />} />
      <Route path="/loans" element={<Loans />} />
      <Route path="/loans/:id" element={<LoanDetail />} />
      <Route path="/reservations" element={<Reservations />} />
      <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/reservations/link/:token" element={<ReservationLink />} />
      <Route path="/admin/copies" element={<AdminCopies />} />
      <Route path="/admin/loans" element={<AdminLoans />} />
      <Route path="/admin/outbox" element={<AdminOutbox />} />
      <Route path="/admin/acquisition" element={<AdminAcquisition />} />
      <Route path="/admin/discounts" element={<AdminDiscounts />} />
      <Route path="/admin/inventory" element={<AdminInventory />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/reservations" element={<AdminReservations />} />
      <Route path="/admin/books" element={<AdminBooks />} />
      <Route path="/admin/series" element={<AdminSeries />} />
      <Route path="/admin/lookup" element={<AdminLookup />} />
      <Route path="/admin/flags" element={<AdminFlags />} />
      <Route path="/admin/reports" element={<AdminReports />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
