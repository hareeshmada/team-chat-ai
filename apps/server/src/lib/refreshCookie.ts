import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true, // JavaScript (and so XSS) can't read it
    secure: env.NODE_ENV === 'production', // HTTPS only; localhost dev is plain http
    sameSite: env.COOKIE_SAMESITE, // strict: never sent on requests started by other sites (CSRF)
    path: '/api/auth', // only sent to auth endpoints, not with every API call
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  // Must use the same path/sameSite/secure as when it was set, or the browser keeps the old cookie.
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
}

export function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
