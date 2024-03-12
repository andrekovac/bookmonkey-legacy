// GET /api/v1/flags: which features are switched on (public, the web app needs it before login)
const express = require('express');
const flags = require('../lib/flags');

const router = express.Router();

router.get('/flags', function (req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(flags.publicFlags());
});

module.exports = router;
