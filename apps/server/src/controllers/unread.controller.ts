import type { MarkReadInput } from '@teamchat/shared';
import type { RequestHandler } from 'express';
import { getChannel } from '../middleware/requireChannelAccess.js';
import { logger } from '../lib/logger.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import { markChannelMentionsRead } from '../services/notification.service.js';
import * as unreadService from '../services/unread.service.js';
import { notifyChannelRead } from '../socket/realtime.js';

export const list: RequestHandler = async (req, res) => {
  const channels = await unreadService.listUnread(getAuthUser(req).userId);
  res.json({ channels });
};

export const markRead: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  const channel = getChannel(req);
  const lastReadMessageId = await unreadService.markRead(
    userId,
    channel,
    (req.body as MarkReadInput).messageId,
  );
  res.json({ lastReadMessageId });
  notifyChannelRead(userId, channel._id.toString(), lastReadMessageId);
  // Mentions you've now seen in the channel leave the bell too (after the response; never fails it).
  markChannelMentionsRead(userId, channel._id.toString(), lastReadMessageId).catch((err: unknown) =>
    logger.error({ err }, 'clearing mention notifications failed'),
  );
};
