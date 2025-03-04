// Reminder job. Runs inside the API process on an interval (there is no cron on the server).
// - 2 days before the due date: "bald fällig"
// - overdue: reminders after 1, 7 and 14 days, after the 3rd one the admins get a mail
// - mondays: one summary mail with all overdue loans to the admins (SUMMARY_WEEKDAY, 0 = Sunday)
const db = require('../db');
const utils = require('../lib/utils');
const logger = require('../lib/logger');
const mailer = require('../lib/mailer');
const loans = require('../services/loans');
const notifications = require('../services/notifications');
const waitlist = require('../services/waitlist');
const requestId = require('../lib/request-id');

const REMINDER_AFTER_DAYS = [1, 7, 14];
const DUE_SOON_DAYS = 2;
const SUMMARY_WEEKDAY = process.env.SUMMARY_WEEKDAY !== undefined ? parseInt(process.env.SUMMARY_WEEKDAY, 10) : 1;

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
  const result = { dueSoon: 0, reminders: 0, escalations: 0, expiredHolds: 0, summaries: 0 };
  try {
    // Abholfrist (48 h) abgelaufen -> next one on the waitlist
    result.expiredHolds = waitlist.expireHolds();

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

      // max. eine Erinnerung pro Tag, sonst kommen nach einem Ausfall 2-3 auf einmal
      if (loan.last_reminder_at && loan.last_reminder_at.slice(0, 10) === utils.today()) return;

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

    if (new Date().getDay() === SUMMARY_WEEKDAY) result.summaries = summary();
  } catch (err) {
    logger.error('[job] overdue failed', err.stack || err);
  } finally {
    running = false;
  }
  if (result.dueSoon || result.reminders || result.expiredHolds) {
    logger.info('[job] overdue: ' + result.dueSoon + ' due soon, ' + result.reminders + ' reminders, ' + result.escalations + ' to admins, ' + result.expiredHolds + ' holds expired');
  }
  return result;
}

// weekly overview for the admins, at most once per week (unless force)
function summary(force) {
  const week = utils.weekKey();
  if (!force && mailer.wasSent('overdue_summary', week)) return 0;
  const late = openLoans()
    .filter(loans.isOverdue)
    .map(function (loan) {
      loan.daysLate = -loans.daysLeft(loan);
      return loan;
    });
  if (!late.length) return 0;
  const sent = notifications.overdueSummary(late, week);
  logger.info('[job] overdue summary: ' + late.length + ' loans, ' + sent + ' admins');
  return sent;
}

function start(minutes) {
  if (timer) return;
  const every = (minutes || 60) * 60 * 1000;
  // first run a bit after start, so the server is up
  const tick = function () {
    requestId.runAs('job', run);
  };
  setTimeout(tick, 5000).unref();
  timer = setInterval(tick, every);
  timer.unref();
  logger.info('[job] overdue reminders every ' + (minutes || 60) + ' min');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { run, summary, start, stop, REMINDER_AFTER_DAYS };
