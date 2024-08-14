// Search for the catalogue (2024, "new search"). Every word has to be found in the title,
// subtitle, author or the description. The description makes the search a lot better
// ("drache", "zauberer", "habits") but every row has to be scanned, no index helps with LIKE '%x%'.
const SEARCH_COLUMNS = ['title', 'subtitle', 'author', 'abstract'];
const MAX_WORDS = 5;
const SNIPPET_CHARS = 140;

function words(q) {
  return String(q || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS);
}

// { sql: '((title LIKE ? OR ...) AND (...))', params: [...] } or null for an empty search
function where(q, columns) {
  const cols = columns || SEARCH_COLUMNS;
  const list = words(q);
  if (!list.length) return null;
  const params = [];
  const parts = list.map(function (word) {
    cols.forEach(() => params.push('%' + word + '%'));
    return '(' + cols.map(c => c + ' LIKE ?').join(' OR ') + ')';
  });
  return { sql: '(' + parts.join(' AND ') + ')', params: params };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// part of the description around the first hit, so the list can show why a book was found.
// { text: '... the dark lord Sauron ...', start: 12, length: 6 } or null when the hit is not in the description
function snippet(abstract, q) {
  if (!abstract) return null;
  const list = words(q);
  if (!list.length) return null;
  const re = new RegExp(list.map(escapeRegExp).join('|'), 'i');
  const m = re.exec(abstract);
  if (!m) return null;
  const from = Math.max(0, m.index - Math.floor(SNIPPET_CHARS / 2));
  const to = Math.min(abstract.length, from + SNIPPET_CHARS);
  let text = abstract.slice(from, to);
  let start = m.index - from;
  if (from > 0) {
    text = '…' + text;
    start += 1;
  }
  if (to < abstract.length) text += '…';
  return { text: text, start: start, length: m[0].length };
}

// in which field was the first word found (for sorting and the little label in the list)
function matchedIn(row, q) {
  const first = words(q)[0];
  if (!first) return null;
  const needle = first.toLowerCase();
  for (let i = 0; i < SEARCH_COLUMNS.length; i++) {
    const value = row[SEARCH_COLUMNS[i]];
    if (value && String(value).toLowerCase().indexOf(needle) !== -1) return SEARCH_COLUMNS[i];
  }
  return null;
}

module.exports = { SEARCH_COLUMNS, words, where, snippet, matchedIn };
