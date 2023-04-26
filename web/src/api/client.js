// fetch based API client (2023). Use this in new code.
// xhr.js and the inline fetch calls in the older pages stay until those pages are touched anyway.
//
//   import api from '../api/client';
//   const books = await api.get('/books', { query: { q: 'tolkien' } });
//   await api.put('/books/' + isbn, { title: 'x' });
//
// Interceptors:
//   api.onRequest(config => config)        change url, headers, body before sending
//   api.onResponse((data, res) => data)    change the parsed body
//   api.onError(err => {})                 see every failed request (ApiError)

const BASE = '/api/v1';

const interceptors = { request: [], response: [], error: [] };

export class ApiError extends Error {
  constructor(message, status, data, requestId) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.requestId = requestId;
  }
}

function newRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function buildUrl(path, query) {
  let url = path.indexOf('/api/') === 0 || /^https?:/.test(path) ? path : BASE + path;
  if (query) {
    const params = new URLSearchParams();
    Object.keys(query).forEach(key => {
      const value = query[key];
      if (value === undefined || value === null || value === '' || value === false) return;
      params.append(key, value === true ? '1' : String(value));
    });
    const qs = params.toString();
    if (qs) url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
  }
  return url;
}

// the API has three ways to say what went wrong
//   v1 shop/admin: { error: '...' }   v1 library: { message: '...' }   v2: { errors: [{ message }] }
export function errorMessage(data, status) {
  if (data && typeof data === 'object') {
    if (data.error) return data.error;
    if (data.message) return data.message;
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map(e => (e.path ? e.path + ': ' : '') + e.message).join(', ');
    }
  }
  if (typeof data === 'string' && data && data.length < 200) return data;
  return 'Request failed (' + status + ')';
}

async function parse(res) {
  if (res.status === 204) return null;
  const type = res.headers.get('Content-Type') || '';
  if (type.indexOf('application/json') !== -1) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  return res.text();
}

export async function request(method, path, options) {
  let config = Object.assign({ method: method, path: path, headers: {} }, options || {});
  config.headers = Object.assign({ Accept: 'application/json', 'X-Request-Id': newRequestId() }, config.headers);
  for (const fn of interceptors.request) {
    config = (await fn(config)) || config;
  }

  const init = {
    method: config.method,
    headers: config.headers,
    credentials: 'include',
    signal: config.signal
  };
  if (config.body !== undefined && config.body !== null) {
    if (config.body instanceof FormData) {
      init.body = config.body;
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(config.body);
    }
  }

  let res;
  try {
    res = await fetch(buildUrl(config.path, config.query), init);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    const offline = new ApiError('Server nicht erreichbar', 0, null, config.headers['X-Request-Id']);
    interceptors.error.forEach(fn => fn(offline));
    throw offline;
  }

  let data = null;
  try {
    data = await parse(res);
  } catch (err) {
    data = null;
  }

  if (!res.ok) {
    const error = new ApiError(errorMessage(data, res.status), res.status, data, res.headers.get('X-Request-Id'));
    interceptors.error.forEach(fn => fn(error));
    throw error;
  }

  if (config.raw) return { data: data, res: res };
  for (const fn of interceptors.response) {
    const changed = await fn(data, res, config);
    if (changed !== undefined) data = changed;
  }
  return data;
}

function remove(list, fn) {
  return function () {
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  };
}

const api = {
  request: request,
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, Object.assign({}, options, { body: body })),
  put: (path, body, options) => request('PUT', path, Object.assign({}, options, { body: body })),
  del: (path, options) => request('DELETE', path, options),
  onRequest(fn) {
    interceptors.request.push(fn);
    return remove(interceptors.request, fn);
  },
  onResponse(fn) {
    interceptors.response.push(fn);
    return remove(interceptors.response, fn);
  },
  onError(fn) {
    interceptors.error.push(fn);
    return remove(interceptors.error, fn);
  }
};

// default interceptors
// 1. session expired -> tell the app (Header listens and reloads the session)
api.onError(err => {
  if (err.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bm:unauthorized', { detail: { requestId: err.requestId } }));
  }
});

// 2. in dev, log slow and failed requests with the request id, makes it easy to find them in the API log
if (import.meta.env && import.meta.env.DEV) {
  api.onRequest(config => {
    config.started = Date.now();
    return config;
  });
  api.onResponse((data, res, config) => {
    const ms = Date.now() - (config.started || Date.now());
    if (ms > 500) console.warn('[api] slow', config.method, config.path, ms + 'ms', res.headers.get('X-Request-Id'));
    return data;
  });
  api.onError(err => {
    if (err.status >= 500 || err.status === 0) console.warn('[api]', err.status, err.message, err.requestId);
  });
}

export default api;
