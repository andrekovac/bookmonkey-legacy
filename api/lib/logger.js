// console logger with timestamps. LOG_LEVEL=trace|info|warn|error
const LEVELS = { trace: 10, info: 20, warn: 30, error: 40 };
const current = LEVELS[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'test' ? LEVELS.error : LEVELS.info);

function log(level, args) {
  if (LEVELS[level] < current) return;
  const line = [new Date().toISOString(), level.toUpperCase()].concat(Array.prototype.slice.call(args));
  if (level === 'error') console.error.apply(console, line);
  else console.log.apply(console, line);
}

module.exports = {
  trace: function () { log('trace', arguments); },
  info: function () { log('info', arguments); },
  warn: function () { log('warn', arguments); },
  error: function () { log('error', arguments); },

  // express middleware: "GET /api/v1/books 200 4ms"
  requests: function (req, res, next) {
    const start = Date.now();
    res.on('finish', function () {
      log('info', [req.method, req.originalUrl, res.statusCode, (Date.now() - start) + 'ms']);
    });
    next();
  }
};
