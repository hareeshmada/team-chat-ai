import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { verifyAccessToken, type AccessTokenClaims } from '../services/token.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireAuth. */
    user?: AccessTokenClaims;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  // The scheme name is case-insensitive (RFC 9110), so "bearer x" is valid too.
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header'));
    return;
  }
  req.user = verifyAccessToken(token); // throws 401 TOKEN_EXPIRED / INVALID_TOKEN
  next();
};

/** For handlers behind requireAuth: returns the typed user or fails loudly if the middleware was skipped. */
export function getAuthUser(req: Request): AccessTokenClaims {
  if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  return req.user;
}
