// admin: mails in the outbox + running the reminder job by hand (moved out of routes.js).
// Mounted below requireAdmin in routes.js, so no role check in here.
const express = require('express');
const utils = require('../lib/utils');
const mailer = require('../lib/mailer');
const overdueJob = require('../jobs/overdue');

const router = express.Router();

router.get('/admin/outbox', function (req, res) {
  res.json(mailer.list({ status: req.query.status, limit: utils.toInt(req.query._limit, 200) }));
});

router.post('/admin/outbox/:id/sent', function (req, res) {
  if (!mailer.markSent(req.params.id)) return res.status(404).json({ error: 'mail not found' });
  res.json({ ok: true });
});

// run the reminder job now instead of waiting for the interval
router.post('/admin/jobs/overdue', function (req, res) {
  res.json(overdueJob.run() || { running: true });
});

// Wochenübersicht right now (also on other days than monday, e.g. before the team meeting)
router.post('/admin/jobs/overdue-summary', function (req, res) {
  res.json({ admins: overdueJob.summary(true) });
});

module.exports = router;
