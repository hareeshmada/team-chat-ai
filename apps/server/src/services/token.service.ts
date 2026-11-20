import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

export interface AccessTokenClaims {
  userId: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  let payload: string | jwt.JwtPayload;
  try {
    // Pin the algorithm: never let the token's own header choose how it is verified.
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired');
    }
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid access token');
  }

  if (typeof payload === 'string' || !payload.sub) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid access token');
  }
  return { userId: payload.sub };
}

/** Opaque refresh token: 48 random bytes, meaningless on its own. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** SHA-256 is enough here: the input is random, so there's nothing to brute-force. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
