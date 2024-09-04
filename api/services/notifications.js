// Texts of all library mails. German, due_soon and hold_ready also in English (2024) for
// people who switched the web app to English. The rest follows when somebody asks.
const mailer = require('../lib/mailer');
const db = require('../db');
const i18n = require('../lib/i18n');

function d(value) {
  if (!value) return '';
  const p = value.slice(0, 10).split('-');
  return p[2] + '.' + p[1] + '.' + p[0];
}

function hello(name, lang) {
  return (lang === 'en' ? 'Hello ' : 'Hallo ') + (name || '') + ',';
}

function languageOf(userId) {
  if (!userId) return i18n.DEFAULT_LANGUAGE;
  return i18n.languageOf(db.open().prepare('SELECT language FROM users WHERE id = ?').get(userId));
}

function link(path) {
  return mailer.BASE_URL + path;
}

// links that work without login, see services/reservation-links.js
// (required lazily: reservation-links -> reservations -> waitlist -> notifications)
function mailLink(kind, r) {
  const links = require('./reservation-links');
  const token = kind === 'decline' ? links.declineToken(r) : links.reserveToken(r);
  return link('/reservations/link/' + encodeURIComponent(token));
}

// 2 days before the due date
function dueSoon(loan) {
  if (languageOf(loan.user_id) === 'en') {
    return mailer.send({
      to: loan.email,
      userId: loan.user_id,
      kind: 'due_soon',
      refId: loan.id,
      subject: 'Due soon: ' + loan.title,
      body: [
        hello(loan.user_name, 'en'),
        '',
        'please return "' + loan.title + '" (copy ' + loan.barcode + ') by ' + d(loan.due_at) + '.',
        loan.renewals < 2
          ? 'You can also renew it: ' + link('/loans')
          : 'It cannot be renewed again.',
        '',
        'Thank you!'
      ].join('\n')
    });
  }
  return mailer.send({
    to: loan.email,
    userId: loan.user_id,
    kind: 'due_soon',
    refId: loan.id,
    subject: 'Rückgabe bald fällig: ' + loan.title,
    body: [
      hello(loan.user_name),
      '',
      'das Buch "' + loan.title + '" (Exemplar ' + loan.barcode + ') muss am ' + d(loan.due_at) + ' zurück.',
      loan.renewals < 2
        ? 'Du kannst es auch verlängern: ' + link('/loans')
        : 'Eine Verlängerung ist leider nicht mehr möglich.',
      '',
      'Danke!'
    ].join('\n')
  });
}

// level 1..3
function overdue(loan, level) {
  const subjects = {
    1: 'Erinnerung: ' + loan.title + ' ist überfällig',
    2: '2. Erinnerung: ' + loan.title,
    3: 'Letzte Erinnerung: ' + loan.title
  };
  const lines = [
    hello(loan.user_name),
    '',
    'das Buch "' + loan.title + '" (Exemplar ' + loan.barcode + ', ' + loan.location + ') war am ' + d(loan.due_at) + ' fällig.',
    'Bitte bring es in die Rückgabebox oder verlängere es, wenn das noch geht.',
    '',
    'Details: ' + link('/loans/' + loan.id)
  ];
  if (level >= 3) {
    lines.push('');
    lines.push('Wenn das Buch verloren ist, sag bitte kurz in der Bibliothek Bescheid.');
  }
  return mailer.send({
    to: loan.email,
    userId: loan.user_id,
    kind: 'overdue_' + level,
    refId: loan.id,
    subject: subjects[level] || subjects[3],
    body: lines.join('\n')
  });
}

// to all admins, once per loan
function overdueEscalation(loan) {
  mailer.admins().forEach(function (admin) {
    mailer.send({
      to: admin.email,
      userId: admin.id,
      kind: 'overdue_admin',
      refId: loan.id,
      subject: 'Überfällig nach 3 Erinnerungen: ' + loan.title,
      body: [
        hello(admin.name),
        '',
        loan.user_name + ' <' + loan.email + '> hat "' + loan.title + '" (' + loan.barcode + ') seit dem ' + d(loan.due_at) + '.',
        'Es wurden 3 Erinnerungen verschickt.',
        '',
        link('/admin/loans')
      ].join('\n')
    });
  });
}

function time(value) {
  return value ? d(value) + ' ' + value.slice(11, 16) + ' Uhr' : '';
}

// copy is on the hold shelf
function holdReady(r) {
  if (languageOf(r.user_id) === 'en') {
    return mailer.send({
      to: r.email,
      userId: r.user_id,
      kind: 'hold_ready',
      refId: r.id,
      subject: 'Your reserved book is here: ' + r.title,
      body: [
        hello(r.user_name, 'en'),
        '',
        '"' + r.title + '" is waiting for you on the hold shelf in ' + (r.copy_location || 'the library') + ' (copy ' + r.barcode + ').',
        'Please pick it up by ' + time(r.expires_at).replace(' Uhr', '') + ', after that it goes to the next person on the waiting list.',
        '',
        'Borrow: ' + link('/books/' + r.isbn),
        '',
        'You do not need the book any more? Please release it here, so the next person gets it:',
        mailLink('decline', r)
      ].join('\n')
    });
  }
  return mailer.send({
    to: r.email,
    userId: r.user_id,
    kind: 'hold_ready',
    refId: r.id,
    subject: 'Dein vorgemerktes Buch ist da: ' + r.title,
    body: [
      hello(r.user_name),
      '',
      '"' + r.title + '" liegt für dich im Abholregal in ' + (r.copy_location || 'der Bibliothek') + ' (Exemplar ' + r.barcode + ').',
      'Bitte hol es bis ' + time(r.expires_at) + ' ab, danach geht es an die nächste Person auf der Warteliste.',
      '',
      'Ausleihen: ' + link('/books/' + r.isbn),
      '',
      'Du brauchst das Buch nicht mehr? Dann gib es hier frei, damit die nächste Person es bekommt:',
      mailLink('decline', r)
    ].join('\n')
  });
}

function holdExpired(r) {
  return mailer.send({
    to: r.email,
    userId: r.user_id,
    kind: 'hold_expired',
    refId: r.id,
    subject: 'Vormerkung abgelaufen: ' + r.title,
    body: [
      hello(r.user_name),
      '',
      'du hast "' + r.title + '" nicht innerhalb von 48 Stunden abgeholt, die Vormerkung ist deshalb abgelaufen.',
      'Du kannst das Buch mit einem Klick wieder vormerken (ohne Anmeldung, 7 Tage gültig):',
      mailLink('reserve', r)
    ].join('\n')
  });
}

module.exports = { dueSoon, overdue, overdueEscalation, holdReady, holdExpired, formatDay: d };
