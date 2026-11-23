import type { createChannelSchema, MessagesQuery } from '@teamchat/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { getChannel } from '../middleware/requireChannelAccess.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import * as channelService from '../services/channel.service.js';
import * as messageService from '../services/message.service.js';

export const list: RequestHandler = async (req, res) => {
  const channels = await channelService.listChannels(
    req.params.workspaceId as string,
    getAuthUser(req).userId,
  );
  res.json({ channels });
};

export const create: RequestHandler = async (req, res) => {
  const channel = await channelService.createChannel(
    req.params.workspaceId as string,
    getAuthUser(req).userId,
    req.body as z.output<typeof createChannelSchema>,
  );
  res.status(201).json({ channel });
};

export const listMessages: RequestHandler = async (req, res) => {
  const page = await messageService.listMessages(
    getChannel(req)._id,
    req.query as unknown as MessagesQuery,
  );
  res.json(page);
};
