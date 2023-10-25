// OpenAPI description of /api/v2, served at /api/v2/openapi.json.
// For the mobile app team (they generate their client from it).
// TODO(chris): search parameters, publishers, generate this from the zod schemas

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: '#/components/schemas/' + name });

const nullable = (type: string, extra?: Schema): Schema => Object.assign({ type: [type, 'null'] }, extra || {});

const errorResponse = (description: string): Schema => ({
  description,
  content: { 'application/json': { schema: ref('Errors') } }
});

const isbnParameter: Schema = {
  name: 'isbn',
  in: 'path',
  required: true,
  description: 'ISBN-10 or ISBN-13, with or without hyphens',
  schema: { type: 'string', example: '978-0-547-92821-0' }
};

const schemas: Record<string, Schema> = {
  Price: {
    type: 'object',
    required: ['net', 'gross', 'currency'],
    properties: {
      net: nullable('number', { description: 'net price after discount, EUR' }),
      gross: nullable('number', { description: 'incl. 7 % VAT, after discount' }),
      grossRegular: nullable('number', { description: 'incl. VAT, without discount' }),
      discount: nullable('number', { description: '0.1 = 10 %' }),
      discountName: nullable('string'),
      currency: { type: 'string', example: 'EUR' }
    }
  },
  BookLinks: {
    type: 'object',
    properties: {
      self: { type: 'string' },
      cover: { type: 'string' },
      predecessor: nullable('string'),
      successor: nullable('string')
    }
  },
  Book: {
    type: 'object',
    required: ['isbn', 'title', 'price', 'links'],
    properties: {
      isbn: { type: 'string', example: '978-0-547-92821-0' },
      title: { type: 'string' },
      subtitle: nullable('string'),
      author: nullable('string'),
      coAuthors: { type: 'array', items: { type: 'string' } },
      publisher: nullable('string'),
      abstract: nullable('string'),
      numPages: nullable('integer'),
      publishedAt: nullable('string', { format: 'date' }),
      price: ref('Price'),
      predecessorIsbn: nullable('string'),
      successorIsbn: nullable('string'),
      links: ref('BookLinks')
    }
  },
  BookSummary: {
    type: 'object',
    description: 'Book without abstract and links, plus cover',
    properties: {
      isbn: { type: 'string' },
      title: { type: 'string' },
      subtitle: nullable('string'),
      author: nullable('string'),
      publisher: nullable('string'),
      numPages: nullable('integer'),
      price: ref('Price'),
      cover: { type: 'string' }
    }
  },
  BookPage: {
    type: 'object',
    properties: {
      items: { type: 'array', items: ref('BookSummary') },
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      pages: { type: 'integer' }
    }
  },
  Errors: {
    type: 'object',
    required: ['errors'],
    properties: {
      errors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['path', 'message'],
          properties: {
            path: { type: 'string', example: 'query.limit' },
            message: { type: 'string' },
            code: { type: 'string' }
          }
        }
      }
    }
  }
};

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'BookMonkey API v2',
    version: '2.0.0-beta',
    description: 'Read only books API. Everything else is still /api/v1 (not documented).'
  },
  servers: [{ url: '/api/v2' }],
  paths: {
    '/books': {
      get: {
        summary: 'List books',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'title or author contains' },
          { name: 'publisher', in: 'query', schema: { type: 'string' } },
          { name: 'available', in: 'query', schema: { type: 'boolean' }, description: 'only books with a copy on the shelf' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['title', 'author', 'price', 'publishedAt', 'publisher'], default: 'title' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        ],
        responses: {
          200: { description: 'one page of books', content: { 'application/json': { schema: ref('BookPage') } } },
          400: errorResponse('invalid query parameter')
        }
      }
    },
    '/books/search': {
      get: {
        summary: 'Search books (title, subtitle, author, publisher, abstract)',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } }],
        responses: {
          200: { description: 'matching books, best first' },
          400: errorResponse('search term too short')
        }
      }
    },
    '/books/{isbn}': {
      get: {
        summary: 'One book',
        parameters: [isbnParameter],
        responses: {
          200: { description: 'the book', content: { 'application/json': { schema: ref('Book') } } },
          400: errorResponse('not a valid ISBN, message says why'),
          404: errorResponse('no book with this ISBN')
        }
      }
    }
  },
  components: { schemas }
};
