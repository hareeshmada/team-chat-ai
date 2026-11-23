import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import type { ChannelDocument } from '../models/Channel.js';
import { assertChannelAccess } from '../services/access.service.js';
import { getAuthUser } from './requireAuth.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireChannelAccess. */
    channel?: ChannelDocument;
  }
}

/**
 * For routes with :channelId (run after requireAuth and validate({ params })).
 * Same rule as the socket handlers: see assertChannelAccess (workspace member + memberIds
 * for private channels). Sets req.channel and req.membership.
 */
export const requireChannelAccess: RequestHandler = async (req, _res, next) => {
  const { channel, membership } = await assertChannelAccess(
    getAuthUser(req).userId,
    req.params.channelId as string,
  );
  req.channel = channel;
  req.membership = membership;
  next();
};

export function getChannel(req: Request): ChannelDocument {
  if (!req.channel) throw new AppError(500, 'INTERNAL_ERROR', 'Channel was not loaded');
  return req.channel;
}
