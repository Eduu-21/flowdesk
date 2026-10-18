import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction, isTest } from '../config';
import { HttpError } from '../utils/errors';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { message: `Route ${req.method} ${req.path} was not found.`, code: 'NOT_FOUND' },
  });
};

/** Centralised error handling: never leaks stack traces or SQL to the client. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fields[key]) fields[key] = issue.message;
    }
    res.status(400).json({
      error: { message: 'Please check the highlighted fields.', code: 'VALIDATION_ERROR', fields },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { message: err.message, code: err.code, fields: err.fields },
    });
    return;
  }

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'The request body is not valid JSON.', code: 'BAD_JSON' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'That upload is too large.', code: 'TOO_LARGE' } });
    return;
  }

  // PostgreSQL errors
  if (err?.code === '23505') {
    res.status(409).json({
      error: { message: 'That record already exists.', code: 'DUPLICATE' },
    });
    return;
  }
  if (err?.code === '23503') {
    res.status(409).json({
      error: {
        message: 'This record is linked to other data and cannot be changed this way.',
        code: 'IN_USE',
      },
    });
    return;
  }
  if (err?.code === '22P02') {
    res.status(400).json({ error: { message: 'One of the identifiers is not valid.', code: 'BAD_ID' } });
    return;
  }

  if (!isTest) console.error('Unhandled error:', isProduction ? err?.message : err);
  res.status(500).json({
    error: { message: 'Something went wrong on our side. Please try again.', code: 'SERVER_ERROR' },
  });
};
