// Database access for v2. Same tables as v1 (routes.js), but all SQL for books lives here.
// TODO(chris): v1 should use this too once routes.js is split up
import db from '../../db.js';
import isbnLib from '../../lib/isbn.js';
import type { BookRow, BookQuery, SortField, Publisher } from './types.ts';

const SORT_COLUMNS: Record<SortField, string> = {
  title: 'title',
  author: 'author',
  price: 'price',
  publishedAt: 'published_at',
  publisher: 'publisher'
};

type Where = { sql: string; params: Array<string | number> };

function where(query: BookQuery): Where {
  const parts: string[] = [];
  const params: Array<string | number> = [];
  if (query.q) {
    parts.push('(title LIKE ? OR author LIKE ?)');
    params.push('%' + query.q + '%', '%' + query.q + '%');
  }
  if (query.publisher) {
    parts.push('publisher = ?');
    params.push(query.publisher);
  }
  if (query.available) {
    parts.push("EXISTS (SELECT 1 FROM copies c WHERE c.book_id = books.id AND c.status = 'available')");
  }
  return { sql: parts.length ? ' WHERE ' + parts.join(' AND ') : '', params };
}

export function listBooks(query: BookQuery): BookRow[] {
  const w = where(query);
  const column = SORT_COLUMNS[query.sort];
  const order = query.order === 'desc' ? 'DESC' : 'ASC';
  const sql = 'SELECT * FROM books' + w.sql + ' ORDER BY ' + column + ' ' + order + ', id LIMIT ? OFFSET ?';
  const params = w.params.concat([query.limit, (query.page - 1) * query.limit]);
  return db.open().prepare(sql).all(...params) as BookRow[];
}

export function countBooks(query: BookQuery): number {
  const w = where(query);
  const row = db.open().prepare('SELECT COUNT(*) AS n FROM books' + w.sql).get(...w.params) as { n: number };
  return row.n;
}

// v2 accepts the isbn with or without hyphens (schema.ts makes it plain),
// the DB has the printed form
export function findByIsbn(isbn: string): BookRow | undefined {
  return db.open().prepare('SELECT * FROM books WHERE isbn = ?').get(isbnLib.format(isbn)) as BookRow | undefined;
}

export function publishers(): Publisher[] {
  const rows = db.open()
    .prepare('SELECT publisher, COUNT(*) AS n FROM books WHERE publisher IS NOT NULL GROUP BY publisher ORDER BY publisher')
    .all() as Array<{ publisher: string; n: number }>;
  return rows.map(r => ({ name: r.publisher, books: r.n }));
}

// v2 search: every word has to match in one of the fields, title hits first.
// LIKE is fine for 50 to 500 books, full text search (FTS5) when the catalogue gets bigger.
export type SearchField = 'title' | 'subtitle' | 'author' | 'publisher' | 'abstract';

export function searchBooks(q: string, fields: SearchField[], limit: number): { rows: BookRow[]; total: number } {
  const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const parts: string[] = [];
  const params: Array<string | number> = [];
  words.forEach(word => {
    parts.push('(' + fields.map(f => f + ' LIKE ?').join(' OR ') + ')');
    fields.forEach(() => params.push('%' + word + '%'));
  });
  const whereSql = ' WHERE ' + parts.join(' AND ');
  const conn = db.open();
  const total = (conn.prepare('SELECT COUNT(*) AS n FROM books' + whereSql).get(...params) as { n: number }).n;
  const rank = 'CASE WHEN title LIKE ? THEN 0 WHEN author LIKE ? THEN 1 ELSE 2 END';
  const rows = conn
    .prepare('SELECT * FROM books' + whereSql + ' ORDER BY ' + rank + ', title LIMIT ?')
    .all(...params, '%' + q + '%', '%' + q + '%', limit) as BookRow[];
  return { rows, total };
}
