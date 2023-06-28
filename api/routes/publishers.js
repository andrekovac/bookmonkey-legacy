// GET /api/v1/publishers (moved out of routes.js, see routes/index.js)
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/publishers', function (req, res) {
  const rows = db.open()
    .prepare('SELECT publisher, COUNT(*) AS count FROM books WHERE publisher IS NOT NULL GROUP BY publisher ORDER BY publisher')
    .all();
  res.json(rows);
});

module.exports = router;
