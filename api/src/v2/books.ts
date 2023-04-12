// /api/v2/books
import express from 'express';
import type { Request, Response } from 'express';
import pricing from '../../lib/pricing.js';
import utils from '../../lib/utils.js';
import * as repo from './repo.ts';
import { bookListQuery, isbnParam, searchQuery } from './schema.ts';
import { validate, notFound } from './http.ts';
import type { Book, BookRow, BookSummary, Page, Price } from './types.ts';

const BASE = '/api/v2/books/';

function coverOf(row: BookRow): string {
  return '/covers/' + row.isbn.replace(/-/g, '') + '.png';
}

function priceOf(row: BookRow): Price {
  const p = pricing.forBook(row);
  return {
    net: p.net,
    gross: p.gross,
    grossRegular: p.grossRegular,
    discount: p.discount,
    discountName: p.discountName,
    currency: row.currency || 'EUR'
  };
}

export function toBook(row: BookRow): Book {
  return {
    isbn: row.isbn,
    title: row.title,
    subtitle: row.subtitle,
    author: row.author,
    coAuthors: utils.parseJson(row.co_authors, []),
    publisher: row.publisher,
    abstract: row.abstract,
    numPages: row.num_pages,
    publishedAt: row.published_at,
    price: priceOf(row),
    predecessorIsbn: row.predecessor_isbn,
    successorIsbn: row.successor_isbn,
    links: {
      self: BASE + encodeURIComponent(row.isbn),
      cover: coverOf(row),
      predecessor: row.predecessor_isbn ? BASE + encodeURIComponent(row.predecessor_isbn) : null,
      successor: row.successor_isbn ? BASE + encodeURIComponent(row.successor_isbn) : null
    }
  };
}

export function toSummary(row: BookRow): BookSummary {
  const book = toBook(row);
  return {
    isbn: book.isbn,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    coAuthors: book.coAuthors,
    publisher: book.publisher,
    numPages: book.numPages,
    publishedAt: book.publishedAt,
    price: book.price,
    predecessorIsbn: book.predecessorIsbn,
    successorIsbn: book.successorIsbn,
    cover: book.links.cover
  };
}

function list(req: Request, res: Response) {
  const query = validate(bookListQuery, req.query, res, 'query');
  if (!query) return;
  const total = repo.countBooks(query);
  const body: Page<BookSummary> = {
    items: repo.listBooks(query).map(toSummary),
    page: query.page,
    limit: query.limit,
    total: total,
    pages: Math.ceil(total / query.limit)
  };
  res.json(body);
}

function publishers(req: Request, res: Response) {
  res.json({ items: repo.publishers() });
}

function detail(req: Request, res: Response) {
  const params = validate(isbnParam, req.params, res, 'params');
  if (!params) return;
  const row = repo.findByIsbn(params.isbn);
  if (!row) return notFound(res, 'isbn', 'book not found');
  res.json(toBook(row));
}

// GET /api/v2/books/search?q=dune&in=title,author&limit=10
function search(req: Request, res: Response) {
  const query = validate(searchQuery, req.query, res, 'query');
  if (!query) return;
  const result = repo.searchBooks(query.q, query.in, query.limit);
  res.json({
    query: query.q,
    fields: query.in,
    total: result.total,
    items: result.rows.map(toSummary)
  });
}

const router = express.Router();
router.get('/', list);
router.get('/search', search);
router.get('/publishers', publishers);
router.get('/:isbn', detail);

export default router;
