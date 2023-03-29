// Helpers for v2 handlers: validation with zod and the { errors: [...] } error shape.
import type { Response } from 'express';
import type { ZodType } from 'zod';
import type { ApiError, ErrorBody } from './types.ts';

export function sendErrors(res: Response, status: number, errors: ApiError[]) {
  const body: ErrorBody = { errors };
  res.status(status).json(body);
}

export function notFound(res: Response, path: string, message: string) {
  sendErrors(res, 404, [{ path, message, code: 'not_found' }]);
}

// parses input with the schema. On error the 400 is sent and null is returned,
// so handlers do: const q = validate(schema, req.query, res, 'query'); if (!q) return;
export function validate<T>(schema: ZodType<T>, input: unknown, res: Response, where: string): T | null {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  sendErrors(res, 400, result.error.issues.map(issue => ({
    path: [where].concat(issue.path.map(String)).join('.'),
    message: issue.message,
    code: issue.code
  })));
  return null;
}
