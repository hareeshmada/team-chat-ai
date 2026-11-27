import { randomUUID } from 'node:crypto';
import type { LoginInput, PublicUser, RegisterInput } from '@teamchat/shared';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User, type UserDocument } from '../models/User.js';
import { acceptInvite, type AcceptedInvite } from './invite.service.js';
import { generateRefreshToken, hashToken, signAccessToken } from './token.service.js';

// 12 rounds ≈ 250 ms per hash: slow on purpose against brute force. Tests use 4 to stay fast.
const BCRYPT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;
// Two tabs refreshing at the same moment both send the same token. Within this window,
// reuse of a just-rotated token is treated as that race, not as theft.
export const REUSE_GRACE_MS = 10_000;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends SessionTokens {
  user: PublicUser;
}

const invalidRefresh = () =>
  new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');

// Compared against when the email doesn't exist, so a login takes the same time either way
// (otherwise response timing reveals which emails are registered).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('timing-safe-dummy-password', BCRYPT_ROUNDS));

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function issueRefreshToken(userId: Types.ObjectId, family: string, token: string) {
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
}

async function startSession(user: UserDocument): Promise<AuthResult> {
  const refreshToken = generateRefreshToken();
  await issueRefreshToken(user._id, randomUUID(), refreshToken);
  return {
    accessToken: signAccessToken(user._id.toString()),
    refreshToken,
    user: toPublicUser(user),
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

export interface RegisterResult extends AuthResult {
  /** Signed up from an invite link: the workspace joined (for the realtime updates). */
  joined?: AcceptedInvite;
}

export async function register({
  name,
  email,
  password,
  inviteToken,
}: RegisterInput): Promise<RegisterResult> {
  const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');

  if (await User.exists({ email })) throw emailTaken();

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let user: UserDocument;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    // Two simultaneous sign-ups with the same email: the unique index catches the loser.
    if (isDuplicateKeyError(err)) throw emailTaken();
    throw err;
  }
  const session = await startSession(user);

  // From an invite link: join its workspace. A bad, expired or someone else's link never
  // blocks the sign-up itself; the user just lands on onboarding instead.
  if (inviteToken) {
    try {
      const joined = await acceptInvite(inviteToken, { id: session.user.id, email: user.email });
      return { ...session, joined };
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
    }
  }
  return session;
}

export async function login({ email, password }: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));

  // Same error for "no such email" and "wrong password": don't reveal which emails exist.
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  return startSession(user);
}

/** Revoke every still-active token in the family (logout, or theft detected). */
async function killFamily(family: string): Promise<void> {
  await RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date() });
}

export async function refresh(rawToken: string | undefined): Promise<SessionTokens> {
  if (!rawToken) throw invalidRefresh();

  let stored = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!stored || stored.expiresAt.getTime() <= Date.now()) throw invalidRefresh();

  const newToken = generateRefreshToken();

  if (!stored.revokedAt) {
    // Atomic claim: only one request can flip revokedAt from null, even if two arrive together.
    const claimed = await RefreshToken.findOneAndUpdate(
      { _id: stored._id, revokedAt: null },
      { revokedAt: new Date(), replacedBy: hashToken(newToken) },
    );
    if (claimed) {
      // Normal rotation: old token revoked, new one issued in the same family.
      await issueRefreshToken(claimed.userId, claimed.family, newToken);
      return { accessToken: signAccessToken(claimed.userId.toString()), refreshToken: newToken };
    }
    // Lost the race to a parallel request: re-read and handle it as a reused token.
    stored = await RefreshToken.findOne({ _id: stored._id });
    if (!stored?.revokedAt) throw invalidRefresh();
  }

  // The token is revoked. A killed token (revokedAt set, replacedBy null) means the session already
  // ended: logout, or theft detected earlier. That's not new reuse; just reject it.
  const sessionEnded = await RefreshToken.exists({
    family: stored.family,
    revokedAt: { $ne: null },
    replacedBy: null,
  });
  if (sessionEnded) throw invalidRefresh();

  // The token was rotated and is used again. Is it the two-tabs race, or a stolen copy?
  const rotatedAgo = Date.now() - stored.revokedAt.getTime();
  if (rotatedAgo <= REUSE_GRACE_MS) {
    await issueRefreshToken(stored.userId, stored.family, newToken);
    return { accessToken: signAccessToken(stored.userId.toString()), refreshToken: newToken };
  }

  // Reuse outside the grace window: assume theft, end the session for everyone.
  await killFamily(stored.family);
  throw new AppError(
    401,
    'REFRESH_TOKEN_REUSED',
    'Refresh token was already used. Please log in again.',
  );
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (stored) await killFamily(stored.family);
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = Types.ObjectId.isValid(userId) ? await User.findById(userId) : null;
  // A valid token for a deleted user is still not a valid session.
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User no longer exists');
  return toPublicUser(user);
}
