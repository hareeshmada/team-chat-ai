import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

interface AuthRateLimitOptions {
  enabled?: boolean;
  limit?: number;
  windowMs?: number;
}

/** Per-IP limiter for login/register. Off in tests (unless a test turns it on explicitly). */
export function createAuthRateLimiter({
  enabled = env.NODE_ENV !== 'test',
  limit = 10,
  windowMs = 60_000,
}: AuthRateLimitOptions = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8', // RateLimit / RateLimit-Policy response headers
    legacyHeaders: false,
    skip: () => !enabled,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many attempts. Try again in a minute.'));
    },
  });
}
