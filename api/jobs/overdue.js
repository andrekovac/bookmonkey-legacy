// Reminder job. Runs inside the API process on an interval (there is no cron on the server).
// - 2 days before the due date: "bald fällig"
// - overdue: reminders after 1, 7 and 14 days, after the 3rd one the admins get a mail
const db = require('../db');
const utils = require('../lib/utils');
const logger = require('../lib/logger');
const mailer = require('../lib/mailer');
const loans = require('../services/loans');
const notifications = require('../services/notifications');

const REMINDER_AFTER_DAYS = [1, 7, 14];
const DUE_SOON_DAYS = 2;

let timer = null;
let running = false;

function openLoans() {
  return db.open().prepare(`SELECT l.*, c.barcode, c.location, b.isbn, b.title, u.email, u.name AS user_name
    FROM loans l
    JOIN copies c ON c.id = l.copy_id
    JOIN books b ON b.id = c.book_id
    JOIN users u ON u.id = l.user_id
    WHERE l.returned_at IS NULL
    ORDER BY l.due_at`).all();
}

function run() {
  if (running) return null;
  running = true;
  const result = { dueSoon: 0, reminders: 0, escalations: 0 };
  try {
    const soon = utils.addDays(DUE_SOON_DAYS);
    const conn = db.open();
    const bump = conn.prepare('UPDATE loans SET reminder_count = reminder_count + 1, last_reminder_at = ? WHERE id = ?');

    openLoans().forEach(function (loan) {
      if (loan.due_at === soon && !mailer.wasSent('due_soon', loan.id)) {
        notifications.dueSoon(loan);
        result.dueSoon++;
        return;
      }
      if (!loans.isOverdue(loan)) return;

      const late = -loans.daysLeft(loan);
      const next = REMINDER_AFTER_DAYS[loan.reminder_count];
      if (next !== undefined && late >= next) {
        notifications.overdue(loan, loan.reminder_count + 1);
        bump.run(utils.now(), loan.id);
        result.reminders++;
        if (loan.reminder_count + 1 === REMINDER_AFTER_DAYS.length) {
          notifications.overdueEscalation(loan);
          result.escalations++;
        }
      }
    });
  } catch (err) {
    logger.error('[job] overdue failed', err.stack || err);
  } finally {
    running = false;
  }
  if (result.dueSoon || result.reminders) {
    logger.info('[job] overdue: ' + result.dueSoon + ' due soon, ' + result.reminders + ' reminders, ' + result.escalations + ' to admins');
  }
  return result;
}

function start(minutes) {
  if (timer) return;
  const every = (minutes || 60) * 60 * 1000;
  // first run a bit after start, so the server is up
  setTimeout(run, 5000).unref();
  timer = setInterval(run, every);
  timer.unref();
  logger.info('[job] overdue reminders every ' + (minutes || 60) + ' min');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { run, start, stop, REMINDER_AFTER_DAYS };
