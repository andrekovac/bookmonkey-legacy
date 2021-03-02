const express = require('express');
const db = require('./db');

const PORT = process.env.PORT || 4780;

const app = express();
app.use(express.json());

app.get('/api/health', function (req, res) {
  res.json({ ok: true });
});

if (require.main === module) {
  db.open();
  app.listen(PORT, function () {
    console.log('BookMonkey API listening on http://localhost:' + PORT);
  });
}

module.exports = app;
