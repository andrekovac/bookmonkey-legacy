const path = require('path');
const express = require('express');
const db = require('./db');
const routes = require('./routes');
const session = require('./lib/session');
const logger = require('./lib/logger');

const PORT = process.env.PORT || 4780;

const app = express();
app.disable('x-powered-by');
app.use(logger.requests);
app.use(express.json({ limit: '1mb' }));
app.use(session.middleware);

app.use('/covers', express.static(path.join(__dirname, 'seed', 'covers'), { maxAge: '1d' }));

// old school admin page for the shop staff, talks to /api/v1 directly
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/api/health', function (req, res) {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/v1', routes);

app.use('/api', function (req, res) {
  res.status(404).json({ error: 'not found' });
});

// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid json' });
  }
  logger.error(req.method, req.originalUrl, err.stack || err);
  res.status(500).json({ error: 'internal error' });
});

if (require.main === module) {
  db.open();
  app.listen(PORT, function () {
    logger.info('BookMonkey API listening on http://localhost:' + PORT);
  });
}

module.exports = app;
