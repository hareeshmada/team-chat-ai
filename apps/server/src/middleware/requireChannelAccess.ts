import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { Channel, type ChannelDocument } from '../models/Channel.js';
import { Membership } from '../models/Membership.js';
import { getAuthUser } from './requireAuth.js';
import { forbidden } from './requireMembership.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireChannelAccess. */
    channel?: ChannelDocument;
  }
}

/**
 * For routes with :channelId (run after requireAuth and validate({ params })).
 * 1. RBAC: you must be a member of the channel's workspace (any role).
 * 2. ReBAC: a private channel also needs you in its memberIds.
 * Sets req.channel and req.membership.
 */
export const requireChannelAccess: RequestHandler = async (req, _res, next) => {
  const { userId } = getAuthUser(req);
  const channel = await Channel.findById(req.params.channelId);
  if (!channel) throw new AppError(404, 'CHANNEL_NOT_FOUND', 'Channel not found');

  const membership = await Membership.findOne({ workspaceId: channel.workspaceId, userId });
  if (!membership) throw forbidden('You do not have access to this channel');

  if (channel.isPrivate && !channel.memberIds.some((id) => id.equals(userId))) {
    throw forbidden('This channel is private');
  }

  req.channel = channel;
  req.membership = membership;
  next();
};

export function getChannel(req: Request): ChannelDocument {
  if (!req.channel) throw new AppError(500, 'INTERNAL_ERROR', 'Channel was not loaded');
  return req.channel;
}
