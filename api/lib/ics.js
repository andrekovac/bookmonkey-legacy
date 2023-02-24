// Minimal iCalendar (.ics) for the due dates, so people can put them into Outlook.
// Only all-day events, that is all we need.

function esc(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// "2022-02-15" -> "20220215"
function day(value) {
  return String(value).slice(0, 10).replace(/-/g, '');
}

function nextDay(value) {
  const d = new Date(String(value).slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// lines longer than 75 octets must be folded (RFC 5545), Outlook is picky about it
function fold(line) {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

// events: [{ uid, date: 'YYYY-MM-DD', summary, description }]
function calendar(name, events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookMonkey//Bibliothek//DE',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:' + esc(name)
  ];
  events.forEach(function (e) {
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + e.uid,
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + day(e.date),
      'DTEND;VALUE=DATE:' + nextDay(e.date),
      'SUMMARY:' + esc(e.summary),
      'DESCRIPTION:' + esc(e.description),
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = { calendar, esc, fold };
