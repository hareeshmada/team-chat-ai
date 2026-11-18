import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

// Errors thrown by express.json() (body-parser) carry a `type` and a 4xx `status`.
type BodyParserError = Error & { type: string; status?: number };

const BODY_PARSER_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  'entity.parse.failed': {
    status: 400,
    code: 'INVALID_JSON',
    message: 'Request body is not valid JSON',
  },
  'entity.too.large': {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Request body is too large',
  },
};

function isBodyParserError(err: unknown): err is BodyParserError {
  return err instanceof Error && typeof (err as Partial<BodyParserError>).type === 'string';
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // Response already started (e.g. mid-stream): let Express close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  if (isBodyParserError(err)) {
    const known = BODY_PARSER_ERRORS[err.type];
    if (known) {
      res.status(known.status).json({ error: { code: known.code, message: known.message } });
      return;
    }
    if (err.status && err.status >= 400 && err.status < 500) {
      res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: err.message } });
      return;
    }
  }

  // Unexpected error. pino-http logs it once (with reqId) on "request errored".
  res.err = err instanceof Error ? err : new Error(String(err));
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      // Stack traces reveal file paths and library versions: never in production.
      ...(env.NODE_ENV !== 'production' && err instanceof Error && { stack: err.stack }),
    },
  });
};
