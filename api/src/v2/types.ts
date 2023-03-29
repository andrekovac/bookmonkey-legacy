// Shared types for /api/v2. Rows are what node:sqlite returns, everything else is what
// we send to clients (camelCase only, no snake_case in v2 responses).

export type BookRow = {
  id: number;
  isbn: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  co_authors: string | null;
  publisher: string | null;
  abstract: string | null;
  num_pages: number | null;
  published_at: string | null;
  price: number | null;
  currency: string | null;
  predecessor_isbn: string | null;
  successor_isbn: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Price = {
  net: number | null;
  gross: number | null;
  grossRegular: number | null;
  discount: number | null;
  discountName: string | null;
  currency: string;
};

export type BookLinks = {
  self: string;
  cover: string;
  predecessor: string | null;
  successor: string | null;
};

export type Book = {
  isbn: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  coAuthors: string[];
  publisher: string | null;
  abstract: string | null;
  numPages: number | null;
  publishedAt: string | null;
  price: Price;
  predecessorIsbn: string | null;
  successorIsbn: string | null;
  links: BookLinks;
};

// short form for lists where the abstract would be too much
export type BookSummary = Omit<Book, 'abstract' | 'links'> & { cover: string };

export type Page<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type SortField = 'title' | 'author' | 'price' | 'publishedAt' | 'publisher';
export type SortOrder = 'asc' | 'desc';

export type BookQuery = {
  q?: string;
  publisher?: string;
  available?: boolean;
  sort: SortField;
  order: SortOrder;
  page: number;
  limit: number;
};

export type ApiError = {
  path: string;
  message: string;
  code?: string;
};

export type ErrorBody = {
  errors: ApiError[];
};

export type Publisher = {
  name: string;
  books: number;
};
