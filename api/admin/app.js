/* BookMonkey admin. No framework, just DOM. Uses the normal /api/v1 endpoints. */
(function () {
  'use strict';

  var API = '/api/v1';
  var books = [];
  var currentIsbn = null;
  var me = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function api(method, url, body) {
    var opts = { method: method, credentials: 'same-origin', headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(API + url, opts).then(function (res) {
      if (res.status === 204) return null;
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('HTTP ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  var msgTimer = null;
  function message(text, isError) {
    var el = $('message');
    el.textContent = text;
    el.className = 'msg ' + (isError ? 'err' : 'ok');
    clearTimeout(msgTimer);
    if (!isError) {
      msgTimer = setTimeout(function () {
        el.className = 'msg hidden';
      }, 3000);
    }
  }

  function show(view) {
    ['login-view', 'books-view', 'edit-view', 'users-view'].forEach(function (id) {
      $(id).className = id === view ? '' : 'hidden';
    });
  }

  // ---- login

  function checkLogin() {
    return api('GET', '/auth/me').then(function (user) {
      if (user.role !== 'admin') {
        message('Kein Admin-Zugang für ' + user.email, true);
        me = null;
        return false;
      }
      me = user;
      $('who').textContent = user.email;
      return true;
    }).catch(function () {
      me = null;
      return false;
    });
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    api('POST', '/auth/login', { email: form.email.value, password: form.password.value })
      .then(checkLogin)
      .then(function (ok) {
        if (ok) {
          form.reset();
          route();
        }
      })
      .catch(function (err) {
        message(err.status === 401 ? 'E-Mail oder Passwort falsch' : err.message, true);
      });
  });

  $('logout').addEventListener('click', function (e) {
    e.preventDefault();
    api('POST', '/auth/logout', {}).then(function () {
      me = null;
      $('who').textContent = '';
      route();
    });
  });

  // ---- books list

  function loadBooks() {
    return api('GET', '/books?_limit=1000').then(function (data) {
      books = data;
      renderBooks();
    }).catch(function (err) {
      message('Bücher konnten nicht geladen werden: ' + err.message, true);
    });
  }

  function renderBooks() {
    var filter = $('filter').value.toLowerCase();
    var rows = [];
    var shown = 0;
    books.forEach(function (b) {
      var haystack = (b.isbn + ' ' + b.title + ' ' + b.author).toLowerCase();
      if (filter && haystack.indexOf(filter) === -1) return;
      shown++;
      rows.push(
        '<tr>' +
          '<td>' + esc(b.isbn) + '</td>' +
          '<td>' + esc(b.title) + '</td>' +
          '<td>' + esc(b.author) + '</td>' +
          '<td>' + esc(b.publisher) + '</td>' +
          '<td class="num">' + esc(b.price) + '</td>' +
          '<td class="num">' + esc(b.numPages) + '</td>' +
          '<td><a href="#edit/' + encodeURIComponent(b.isbn) + '">bearbeiten</a></td>' +
        '</tr>'
      );
    });
    $('books-body').innerHTML = rows.join('');
    $('count').textContent = shown + ' von ' + books.length;
  }

  $('filter').addEventListener('input', renderBooks);

  // ---- edit / create

  var FIELDS = ['isbn', 'title', 'subtitle', 'author', 'coAuthors', 'publisher', 'numPages',
    'publishedAt', 'price', 'predecessorIsbn', 'successorIsbn', 'abstract'];

  function fillForm(book) {
    var form = $('book-form');
    FIELDS.forEach(function (name) {
      var value = book ? book[name] : '';
      if (name === 'coAuthors' && Array.isArray(value)) value = value.join(', ');
      form[name].value = value === null || value === undefined ? '' : value;
    });
    form.isbn.readOnly = !!book;
  }

  function readForm() {
    var form = $('book-form');
    var data = {};
    FIELDS.forEach(function (name) {
      data[name] = form[name].value.trim();
    });
    return data;
  }

  function editBook(isbn) {
    show('edit-view');
    currentIsbn = isbn;
    $('delete').style.display = '';
    $('edit-title').textContent = 'Buch bearbeiten';
    api('GET', '/books/' + encodeURIComponent(isbn)).then(function (book) {
      fillForm(book);
    }).catch(function (err) {
      message(err.message, true);
    });
  }

  function newBook() {
    show('edit-view');
    currentIsbn = null;
    $('delete').style.display = 'none';
    $('edit-title').textContent = 'Neues Buch';
    fillForm(null);
  }

  $('book-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = readForm();
    var req;
    if (currentIsbn) {
      delete data.isbn;
      req = api('PUT', '/books/' + encodeURIComponent(currentIsbn), data);
    } else {
      req = api('POST', '/books', data);
    }
    req.then(function (book) {
      message('Gespeichert');
      currentIsbn = book.isbn;
      fillForm(book);
      location.hash = '#edit/' + encodeURIComponent(book.isbn);
      loadBooks();
    }).catch(function (err) {
      message('Fehler: ' + err.message, true);
    });
  });

  $('cancel').addEventListener('click', function () {
    location.hash = '#books';
  });

  $('delete').addEventListener('click', function () {
    if (!currentIsbn) return;
    if (!confirm('Buch ' + currentIsbn + ' wirklich löschen?')) return;
    api('DELETE', '/books/' + encodeURIComponent(currentIsbn)).then(function () {
      message('Gelöscht');
      location.hash = '#books';
      loadBooks();
    }).catch(function (err) {
      message(err.message, true);
    });
  });

  // ---- users

  function loadUsers() {
    show('users-view');
    api('GET', '/users').then(function (users) {
      $('users-body').innerHTML = users.map(function (u) {
        return '<tr><td>' + u.id + '</td><td>' + esc(u.email) + '</td><td>' + esc(u.name) +
          '</td><td>' + esc(u.role) + '</td></tr>';
      }).join('');
    }).catch(function (err) {
      message(err.message, true);
    });
  }

  // ---- routing via location.hash

  function route() {
    if (!me) {
      show('login-view');
      return;
    }
    var hash = location.hash.replace(/^#/, '') || 'books';
    if (hash.indexOf('edit/') === 0) {
      editBook(decodeURIComponent(hash.slice(5)));
    } else if (hash === 'new') {
      newBook();
    } else if (hash === 'users') {
      loadUsers();
    } else {
      show('books-view');
      if (!books.length) loadBooks();
      else renderBooks();
    }
  }

  window.addEventListener('hashchange', route);

  checkLogin().then(route);
})();
