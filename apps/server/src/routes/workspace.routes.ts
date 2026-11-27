import {
  createChannelSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  workspaceParamsSchema,
} from '@teamchat/shared';
import { Router } from 'express';
import * as channels from '../controllers/channel.controller.js';
import * as workspaces from '../controllers/workspace.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createWriteRateLimiter } from '../middleware/rateLimit.js';
import { requireMembership } from '../middleware/requireMembership.js';
import { validate } from '../middleware/validate.js';

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

// One shared per-user budget for every create endpoint below (20/min by default).
const writeLimit = createWriteRateLimiter();

workspaceRouter.post('/', writeLimit, validate({ body: createWorkspaceSchema }), workspaces.create);
workspaceRouter.get('/', workspaces.listMine);

// validate params first, so requireMembership never queries with a malformed id.
const params = validate({ params: workspaceParamsSchema });

workspaceRouter.get('/:workspaceId/members', params, requireMembership(), workspaces.listMembers);
workspaceRouter.post(
  '/:workspaceId/members',
  writeLimit,
  validate({ params: workspaceParamsSchema, body: inviteMemberSchema }),
  requireMembership('admin'),
  workspaces.invite,
);

workspaceRouter.get(
  '/:workspaceId/invites',
  params,
  requireMembership('admin'),
  workspaces.listInvites,
);

workspaceRouter.get('/:workspaceId/channels', params, requireMembership(), channels.list);
workspaceRouter.post(
  '/:workspaceId/channels',
  writeLimit,
  validate({ params: workspaceParamsSchema, body: createChannelSchema }),
  requireMembership(),
  channels.create,
);
