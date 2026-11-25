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

/**
 * ONE per-user budget for every AI request (panel questions and channel summaries): each costs
 * provider quota. 20 per minute; the daily token limit comes in Step 4.4. (@ai in channels goes
 * through the socket send budget instead.)
 */
export const aiRequestLimit = createWriteRateLimiter({ limit: 20 });

/**
 * Upload signatures: 30 per minute per user (one per file, up to 5 files per message). Each one
 * lets the browser put a file into our Cloudinary account, so it's limited like other writes.
 */
export const uploadSignLimit = createWriteRateLimiter({ limit: 30 });

/** Separate budget, so a user who hit the sign limit can still clean up what they uploaded. */
export const uploadDiscardLimit = createWriteRateLimiter({ limit: 30 });
