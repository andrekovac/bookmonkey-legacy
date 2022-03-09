// Texts of all library mails. German only, the employees are all in DE.
const mailer = require('../lib/mailer');

function d(value) {
  if (!value) return '';
  const p = value.slice(0, 10).split('-');
  return p[2] + '.' + p[1] + '.' + p[0];
}

function hello(name) {
  return 'Hallo ' + (name || '') + ',';
}

function link(path) {
  return mailer.BASE_URL + path;
}

// 2 days before the due date
function dueSoon(loan) {
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

module.exports = { dueSoon, overdue, overdueEscalation, formatDay: d };
