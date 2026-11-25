import { channelParamsSchema, markReadSchema, messagesQuerySchema } from '@teamchat/shared';
import { Router } from 'express';
import * as ai from '../controllers/ai.controller.js';
import * as channels from '../controllers/channel.controller.js';
import * as unread from '../controllers/unread.controller.js';
import { aiRequestLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireChannelAccess } from '../middleware/requireChannelAccess.js';
import { validate } from '../middleware/validate.js';

export const channelRouter = Router();

channelRouter.use(requireAuth);

channelRouter.get(
  '/:channelId/messages',
  validate({ params: channelParamsSchema, query: messagesQuerySchema }),
  requireChannelAccess,
  channels.listMessages,
);

/** Move your read marker forward (never back) to this message. */
channelRouter.post(
  '/:channelId/read',
  validate({ params: channelParamsSchema, body: markReadSchema }),
  requireChannelAccess,
  unread.markRead,
);

/** A private AI catch-up summary of the last 100 messages, streamed as chunked text. */
channelRouter.post(
  '/:channelId/summary',
  validate({ params: channelParamsSchema }),
  requireChannelAccess,
  aiRequestLimit,
  ai.summarize,
);
