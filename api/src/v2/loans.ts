// /api/v2/me/loans for the mobile app ("Meine Ausleihen").
// Not mounted yet: v2 has no auth middleware of its own, and the app team wants token auth
// instead of the cookie. Until then the app uses GET /api/v1/loans.
// TODO(chris): auth for v2, then v2.use('/me/loans', loans) in app.ts
import express from 'express';
import type { Request, Response } from 'express';
import loanService from '../../services/loans.js';
import utils from '../../lib/utils.js';
import { z } from 'zod';
import { validate, sendErrors } from './http.ts';
import type { Loan, LoanRow, LoanStatus } from './types.ts';

const DUE_SOON_DAYS = 3;

const historyQuery = z.object({
  history: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(v => v === true || v === '1' || v === 'true'),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

// "2023-11-08 09:15:00" (old rows) and "2023-11-08T08:15:00.000Z" (new rows) -> ISO
export function toIso(value: string | null): string | null {
  if (!value) return null;
  if (value.indexOf('T') !== -1) return value;
  // local time of the server, same as utils.now() wrote it
  const d = new Date(value.replace(' ', 'T'));
  return isNaN(d.getTime()) ? value : d.toISOString();
}

function statusOf(row: LoanRow, daysLeft: number | null): LoanStatus {
  if (row.returned_at) return 'returned';
  if (daysLeft !== null && daysLeft < 0) return 'overdue';
  if (daysLeft !== null && daysLeft <= DUE_SOON_DAYS) return 'dueSoon';
  return 'open';
}

export function toLoan(row: LoanRow): Loan {
  const daysLeft = row.returned_at ? null : (loanService.daysLeft(row) as number);
  return {
    id: row.id,
    status: statusOf(row, daysLeft),
    borrowedAt: toIso(row.borrowed_at) as string,
    dueAt: row.due_at,
    returnedAt: toIso(row.returned_at),
    daysLeft: daysLeft,
    renewals: row.renewals,
    renewable: !row.returned_at && row.renewals < loanService.MAX_RENEWALS && (daysLeft === null || daysLeft >= 0),
    copy: { barcode: row.barcode, location: row.location },
    book: {
      isbn: row.isbn,
      title: row.title,
      author: row.author,
      cover: '/covers/' + row.isbn.replace(/-/g, '') + '.png'
    }
  };
}

function uid(req: Request): number | null {
  const session = (req as Request & { session?: { uid?: number } }).session;
  return session && session.uid ? session.uid : null;
}

function list(req: Request, res: Response) {
  const userId = uid(req);
  if (!userId) return sendErrors(res, 401, [{ path: '', message: 'not logged in', code: 'unauthorized' }]);
  const query = validate(historyQuery, req.query, res, 'query');
  if (!query) return;
  const rows = (query.history ? loanService.historyFor(userId, query.limit) : loanService.openLoansFor(userId)) as LoanRow[];
  res.json({ items: rows.map(toLoan), today: utils.today() });
}

function detail(req: Request, res: Response) {
  const userId = uid(req);
  if (!userId) return sendErrors(res, 401, [{ path: '', message: 'not logged in', code: 'unauthorized' }]);
  const row = loanService.findLoan(req.params.id) as LoanRow | undefined;
  if (!row || row.user_id !== userId) {
    return sendErrors(res, 404, [{ path: 'params.id', message: 'loan not found', code: 'not_found' }]);
  }
  res.json(toLoan(row));
}

const router = express.Router();
router.get('/', list);
router.get('/:id', detail);

export default router;
