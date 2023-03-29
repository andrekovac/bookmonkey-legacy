// Request validation for v2 (zod). Errors are turned into { errors: [...] } in app.ts
import { z } from 'zod';
import isbnLib from '../../lib/isbn.js';

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

export const isbnParam = z.object({
  isbn: z.string().trim().refine(v => isbnLib.isValid(v), { message: 'not a valid ISBN-13' })
});

export type BookListQuery = z.infer<typeof bookListQuery>;
