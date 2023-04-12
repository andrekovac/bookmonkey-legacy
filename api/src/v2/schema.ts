// Request validation for v2 (zod). Errors are turned into { errors: [...] } by http.ts
import { z } from 'zod';
import { check } from './isbn.ts';

const SORT_FIELDS = ['title', 'author', 'price', 'publishedAt', 'publisher'] as const;

// query strings are always strings, "1" / "true" / "yes" all mean true
const flag = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform(v => v === true || v === '1' || v === 'true' || v === 'yes');

export const bookListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  publisher: z.string().trim().max(200).optional(),
  available: flag,
  sort: z.enum(SORT_FIELDS).default('title'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// ISBN-10 or ISBN-13, with or without hyphens. Output is always the plain ISBN-13
export const isbn = z.string().trim().transform((value, ctx) => {
  const result = check(value);
  if (!result.valid) {
    ctx.addIssue({ code: 'custom', message: result.reason });
    return z.NEVER;
  }
  return result.isbn13;
});

export const isbnParam = z.object({ isbn });

export const SEARCH_FIELDS = ['title', 'subtitle', 'author', 'publisher', 'abstract'] as const;

export const searchQuery = z.object({
  q: z.string().trim().min(2, 'search term needs at least 2 characters').max(100),
  // comma separated: in=title,author
  in: z
    .string()
    .optional()
    .transform(v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : SEARCH_FIELDS.slice()))
    .pipe(z.array(z.enum(SEARCH_FIELDS)).min(1)),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

export type BookListQuery = z.infer<typeof bookListQuery>;
export type SearchQuery = z.infer<typeof searchQuery>;
