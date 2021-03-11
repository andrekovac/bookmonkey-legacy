// Small XMLHttpRequest wrapper. Callback style: cb(err, data, xhr)
// All requests go to the same origin, vite proxies /api to the API server.

const BASE = '/api/v1';

function parse(xhr) {
  const type = xhr.getResponseHeader('Content-Type') || '';
  if (type.indexOf('application/json') !== -1 && xhr.responseText) {
    try {
      return JSON.parse(xhr.responseText);
    } catch (e) {
      return null;
    }
  }
  return xhr.responseText;
}

export function request(method, url, body, cb) {
  if (typeof body === 'function') {
    cb = body;
    body = null;
  }
  const xhr = new XMLHttpRequest();
  xhr.open(method, url.indexOf('/') === 0 && url.indexOf('/api') !== 0 ? BASE + url : url);
  xhr.withCredentials = true;
  xhr.setRequestHeader('Accept', 'application/json');
  if (body) xhr.setRequestHeader('Content-Type', 'application/json');

  xhr.onload = function () {
    const data = parse(xhr);
    if (xhr.status >= 200 && xhr.status < 300) {
      cb(null, data, xhr);
    } else {
      const err = new Error((data && data.error) || 'Request failed (' + xhr.status + ')');
      err.status = xhr.status;
      err.data = data;
      cb(err, null, xhr);
    }
  };
  xhr.onerror = function () {
    const err = new Error('Server nicht erreichbar');
    err.status = 0;
    cb(err, null, xhr);
  };
  xhr.send(body ? JSON.stringify(body) : null);
  return xhr;
}

export function get(url, cb) {
  return request('GET', url, null, cb);
}

export function post(url, body, cb) {
  return request('POST', url, body, cb);
}

export function put(url, body, cb) {
  return request('PUT', url, body, cb);
}

export function del(url, cb) {
  return request('DELETE', url, null, cb);
}

// {a: 1, b: ''} -> "?a=1"
export function query(params) {
  const parts = [];
  Object.keys(params || {}).forEach(function (key) {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  });
  return parts.length ? '?' + parts.join('&') : '';
}

export default { request, get, post, put, del, query };
