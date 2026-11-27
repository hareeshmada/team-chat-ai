import type { RequestHandler } from 'express';
import { getAuthUser } from '../middleware/requireAuth.js';
import * as authService from '../services/auth.service.js';
import * as inviteService from '../services/invite.service.js';
import { broadcastInvite } from '../socket/eventRelay.js';
import { notifyMemberAdded } from '../socket/realtime.js';
import { logger } from '../lib/logger.js';

// req.params.token was checked by validate() (inviteTokenParamsSchema).

/** Public: who invited you to what (the sign-up banner). */
export const preview: RequestHandler = async (req, res) => {
  const invite = await inviteService.getInvitePreview(req.params.token as string);
  res.json({ invite });
};

/** Signed in: open the link and join (the account was created without it, or already existed). */
export const accept: RequestHandler = async (req, res) => {
  const me = await authService.getMe(getAuthUser(req).userId);
  const { workspace, invite } = await inviteService.acceptInvite(req.params.token as string, me);
  res.json({ workspaceId: workspace.id });

  notifyMemberAdded(workspace, me.id);
  broadcastInvite(invite.id).catch((err: unknown) =>
    logger.error({ err }, 'invite notifications failed'),
  );
};
