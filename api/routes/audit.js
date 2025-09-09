// Änderungsprotokoll (2025). Mounted below requireAdmin in routes.js.
const express = require('express');
const utils = require('../lib/utils');
const audit = require('../lib/audit');

const router = express.Router();

// GET /admin/audit?entity=book&id=978-...&q=...&_limit=
router.get('/admin/audit', function (req, res) {
  if (req.query.entity && audit.ENTITIES.indexOf(req.query.entity) === -1) {
    return res.status(400).json({ message: 'entity must be one of ' + audit.ENTITIES.join(', ') });
  }
  res.json(audit.list({
    entity: req.query.entity,
    entityId: req.query.id,
    q: req.query.q,
    limit: utils.toInt(req.query._limit, 200)
  }));
});

module.exports = router;
