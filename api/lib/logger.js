// console logger with timestamps. LOG_LEVEL=trace|info|warn|error
// LOG_FORMAT=json writes one JSON object per line (for the log shipper on the server)
const requestId = require('./request-id');

const LEVELS = { trace: 10, info: 20, warn: 30, error: 40 };
const current = LEVELS[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'test' ? LEVELS.error : LEVELS.info);
const JSON_FORMAT = process.env.LOG_FORMAT === 'json';

function text(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

function log(level, args, extra) {
  if (LEVELS[level] < current) return;
  const parts = Array.prototype.slice.call(args);
  const id = requestId.current();

  if (JSON_FORMAT) {
    const entry = Object.assign({ time: new Date().toISOString(), level: level }, extra || {});
    if (id) entry.requestId = id;
    entry.msg = parts.map(text).join(' ');
    const out = JSON.stringify(entry);
    if (level === 'error') console.error(out);
    else console.log(out);
    return;
  }

  const line = [new Date().toISOString(), level.toUpperCase()];
  if (id) line.push('[' + id.slice(0, 8) + ']');
  const all = line.concat(parts);
  if (level === 'error') console.error.apply(console, all);
  else console.log.apply(console, all);
}

module.exports = {
  trace: function () { log('trace', arguments); },
  info: function () { log('info', arguments); },
  warn: function () { log('warn', arguments); },
  error: function () { log('error', arguments); },

  // express middleware: "GET /api/v1/books 200 4ms"
  // needs requestId.middleware in front of it, otherwise the lines have no id
  requests: function (req, res, next) {
    const start = Date.now();
    res.on('finish', function () {
      const ms = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : 'info';
      log(level, [req.method, req.originalUrl, res.statusCode, ms + 'ms'], {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms: ms,
        uid: req.session ? req.session.uid : null
      });
    });
    next();
  }
};
