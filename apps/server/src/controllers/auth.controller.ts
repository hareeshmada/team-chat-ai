import type {
  AuthResponse,
  LoginInput,
  PublicUser,
  RefreshResponse,
  RegisterInput,
} from '@teamchat/shared';
import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../lib/refreshCookie.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import * as authService from '../services/auth.service.js';
import { broadcastInvite } from '../socket/eventRelay.js';

// req.body has already been parsed by validate() with the matching shared schema.

export const register: RequestHandler = async (req, res) => {
  const { accessToken, refreshToken, user, joined } = await authService.register(
    req.body as RegisterInput,
  );
  setRefreshCookie(res, refreshToken);
  const body: AuthResponse = { accessToken, user };
  res.status(201).json(body);
  // Joined from an invite link: the inviting admins' modals show "joined".
  if (joined) {
    broadcastInvite(joined.invite.id).catch((err: unknown) =>
      logger.error({ err }, 'invite notifications failed'),
    );
  }
};

export const login: RequestHandler = async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body as LoginInput);
  setRefreshCookie(res, refreshToken);
  const body: AuthResponse = { accessToken, user };
  res.json(body);
};

export const refresh: RequestHandler = async (req, res) => {
  try {
    const { accessToken, refreshToken } = await authService.refresh(readRefreshCookie(req));
    setRefreshCookie(res, refreshToken);
    const body: RefreshResponse = { accessToken };
    res.json(body);
  } catch (err) {
    clearRefreshCookie(res); // a dead refresh cookie is useless; remove it from the browser
    throw err;
  }
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  const user: PublicUser = await authService.getMe(getAuthUser(req).userId);
  res.json({ user });
};
