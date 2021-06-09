const path = require('path');
const express = require('express');
const db = require('./db');
const routes = require('./routes');
const session = require('./lib/session');

const PORT = process.env.PORT || 4780;

const app = express();
app.use(express.json());
app.use(session.middleware);

app.use('/covers', express.static(path.join(__dirname, 'seed', 'covers'), { maxAge: '1d' }));

// old school admin page for the shop staff, talks to /api/v1 directly
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/api/health', function (req, res) {
  res.json({ ok: true });
});

app.use('/api/v1', routes);

if (require.main === module) {
  db.open();
  app.listen(PORT, function () {
    console.log('BookMonkey API listening on http://localhost:' + PORT);
  });
}

module.exports = app;
