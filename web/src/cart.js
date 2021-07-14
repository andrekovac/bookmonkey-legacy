// cart state shared between header and pages
import xhr from './api/xhr';

let cart = { items: [], count: 0, total: 0 };
const listeners = [];

function set(data) {
  cart = data || { items: [], count: 0, total: 0 };
  listeners.forEach(fn => fn(cart));
}

export function getCart() {
  return cart;
}

export function subscribe(fn) {
  listeners.push(fn);
  return function () {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function refresh(cb) {
  xhr.get('/cart', function (err, data) {
    if (err) {
      // not logged in -> empty cart
      set(null);
      if (cb) cb(err.status === 401 ? null : err, cart);
      return;
    }
    set(data);
    if (cb) cb(null, cart);
  });
}

export function add(isbn, qty, cb) {
  xhr.post('/cart', { isbn: isbn, qty: qty || 1 }, function (err, data) {
    if (!err) set(data);
    if (cb) cb(err, cart);
  });
}

export function clear() {
  set(null);
}
