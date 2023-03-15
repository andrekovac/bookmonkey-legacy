// Correlation id for every request.
// The id comes from the X-Request-Id header (nginx in front of the API sets it) or is
// generated here. It is sent back in the response and added to every log line that is
// written while the request is handled, also from services and jobs called by the request.
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const HEADER = 'x-request-id';
const storage = new AsyncLocalStorage();

// only accept ids that look harmless in a log file
const VALID = /^[A-Za-z0-9._:-]{8,64}$/;

function fromHeader(value) {
  if (!value) return null;
  const v = Array.isArray(value) ? value[0] : String(value);
  return VALID.test(v) ? v : null;
}

function create() {
  return crypto.randomUUID();
}

function middleware(req, res, next) {
  const id = fromHeader(req.headers[HEADER]) || create();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  storage.run({ requestId: id, started: Date.now() }, next);
}

// id of the request that is handled right now, or null (jobs, scripts)
function current() {
  const store = storage.getStore();
  return store ? store.requestId : null;
}

// run fn with a fresh id, for jobs: "[job-3f2a...] overdue: 3 mails"
function runAs(prefix, fn) {
  return storage.run({ requestId: prefix + '-' + create().slice(0, 8), started: Date.now() }, fn);
}

module.exports = { HEADER, middleware, current, runAs, fromHeader };
