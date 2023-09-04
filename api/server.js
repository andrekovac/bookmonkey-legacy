const path = require('path');
const express = require('express');
const db = require('./db');
const routes = require('./routes');
// TypeScript, runs without a build step (only erasable syntax, see docs/adr/0001)
const v2 = require('./src/v2/app.ts').default;
const session = require('./lib/session');
const logger = require('./lib/logger');
const requestId = require('./lib/request-id');
const overdueJob = require('./jobs/overdue');

const PORT = process.env.PORT || 4780;

const app = express();
app.disable('x-powered-by');
app.use(requestId.middleware);
app.use(logger.requests);
app.use(express.json({ limit: '1mb' }));
app.use(session.middleware);

app.use('/covers', express.static(path.join(__dirname, 'seed', 'covers'), { maxAge: '1d' }));

// old admin page for the shop staff, talks to /api/v1 directly.
// stays here until the admin in the web app is done
app.use('/admin-old', express.static(path.join(__dirname, 'legacy', 'admin-old')));
app.get('/admin', function (req, res) {
  res.redirect('/admin-old/');
});

app.get('/api/health', function (req, res) {
  res.json({ ok: true, time: new Date().toISOString() });
});

// for the load balancer and CI: 200 only when the database answers
const started = new Date().toISOString();
app.get('/health', function (req, res) {
  let dbOk = false;
  try {
    dbOk = db.open().prepare('SELECT 1 AS ok').get().ok === 1;
  } catch (err) {
    logger.error('health: database', err);
  }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'down',
    db: dbOk ? 'ok' : 'error',
    started: started,
    uptime: Math.round(process.uptime()),
    node: process.version
  });
});

app.use('/api/v1', routes);
app.use('/api/v2', v2);

app.use('/api', function (req, res) {
  res.status(404).json({ error: 'not found' });
});

// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid json' });
  }
  logger.error(req.method, req.originalUrl, err.stack || err);
  res.status(500).json({ error: 'internal error', requestId: req.id });
});

if (require.main === module) {
  db.open();
  app.listen(PORT, function () {
    logger.info('BookMonkey API listening on http://localhost:' + PORT);
  });
  // Mahnungen. JOBS=off to disable (e.g. on a second instance)
  if (process.env.JOBS !== 'off') {
    overdueJob.start(parseInt(process.env.OVERDUE_INTERVAL_MIN, 10) || 60);
  }
}

module.exports = app;
