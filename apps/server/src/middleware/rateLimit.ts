import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { getAuthUser } from './requireAuth.js';

interface RateLimitOptions {
  enabled?: boolean;
  limit?: number;
  windowMs?: number;
}

const tooManyRequests = (message: string) => () => new AppError(429, 'TOO_MANY_REQUESTS', message);

/** Per-IP limiter for login/register. Off in tests (unless a test turns it on explicitly). */
export function createAuthRateLimiter({
  enabled = env.NODE_ENV !== 'test',
  limit = 10,
  windowMs = 60_000,
}: RateLimitOptions = {}) {
  const error = tooManyRequests('Too many attempts. Try again in a minute.');
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8', // RateLimit / RateLimit-Policy response headers
    legacyHeaders: false,
    skip: () => !enabled,
    handler: (_req, _res, next) => next(error()),
  });
}

/**
 * Per-USER limiter for "create" endpoints (workspaces, channels, invites), so one account can't
 * flood the database or a workspace. Keyed by user id, not IP: the user is known (it runs after
 * requireAuth), and many users can share one IP (an office, a mobile carrier).
 * Create ONE instance and share it, so all create endpoints draw from the same per-user budget.
 * Off in tests unless enabled explicitly.
 */
export function createWriteRateLimiter({
  enabled = env.NODE_ENV !== 'test',
  limit = 20,
  windowMs = 60_000,
}: RateLimitOptions = {}) {
  const error = tooManyRequests('Too many requests. Try again in a minute.');
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${getAuthUser(req).userId}`,
    skip: () => !enabled,
    handler: (_req, _res, next) => next(error()),
  });
}
