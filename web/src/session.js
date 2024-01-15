// Who is logged in. Very small store, components subscribe() to changes.
import xhr from './api/xhr';
import { setLanguage } from './i18n';

let currentUser = null;
let loaded = false;
const listeners = [];

function emit() {
  listeners.forEach(fn => fn(currentUser));
}

export function getUser() {
  return currentUser;
}

export function isLoaded() {
  return loaded;
}

export function isAdmin() {
  return !!currentUser && currentUser.role === 'admin';
}

export function subscribe(fn) {
  listeners.push(fn);
  return function unsubscribe() {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function load(cb) {
  xhr.get('/auth/me', function (err, user) {
    loaded = true;
    currentUser = err ? null : user;
    // the language saved in the profile wins over the one of this browser
    if (currentUser && currentUser.language) setLanguage(currentUser.language);
    emit();
    if (cb) cb(currentUser);
  });
}

export function login(email, password, cb) {
  xhr.post('/auth/login', { email: email, password: password }, function (err, user) {
    if (err) return cb(err);
    currentUser = user;
    if (user.language) setLanguage(user.language);
    emit();
    cb(null, user);
  });
}

export function logout(cb) {
  xhr.post('/auth/logout', {}, function () {
    currentUser = null;
    emit();
    if (cb) cb();
  });
}
