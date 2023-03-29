// /api/v2, see docs/adr/0001-typescript-migration.md
// Mounted in server.js. Only books (read) for now, everything else is still v1.
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import logger from '../../lib/logger.js';
import books from './books.ts';
import { sendErrors } from './http.ts';

const VERSION = '2.0.0-beta';

const v2 = express.Router();

v2.use(function (req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-API-Version', VERSION);
  next();
});

v2.get('/', function (req: Request, res: Response) {
  res.json({
    version: VERSION,
    resources: {
      books: '/api/v2/books'
    }
  });
});

v2.use('/books', books);

v2.use(function (req: Request, res: Response) {
  sendErrors(res, 404, [{ path: req.path, message: 'not found', code: 'not_found' }]);
});

// eslint-disable-next-line no-unused-vars
v2.use(function (err: Error & { status?: number }, req: Request, res: Response, next: NextFunction) {
  logger.error('[v2]', req.method, req.originalUrl, err.stack || err);
  sendErrors(res, err.status || 500, [{ path: '', message: err.status ? err.message : 'internal error', code: 'internal' }]);
});

export default v2;
