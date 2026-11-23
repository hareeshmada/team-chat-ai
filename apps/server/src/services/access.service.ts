import { AppError } from '../errors/AppError.js';
import { Channel, type ChannelDocument } from '../models/Channel.js';
import { Membership, type MembershipDocument } from '../models/Membership.js';

export const forbidden = (message = 'You do not have access to this workspace') =>
  new AppError(403, 'FORBIDDEN', message);

/**
 * The one channel-access rule, used by HTTP (requireChannelAccess) and sockets:
 * 1. RBAC: you must be a member of the channel's workspace (any role).
 * 2. ReBAC: a private channel also needs you in its memberIds.
 * Unknown channel → 404 CHANNEL_NOT_FOUND; otherwise no access → 403 FORBIDDEN.
 */
export async function assertChannelAccess(
  userId: string,
  channelId: string,
): Promise<{ channel: ChannelDocument; membership: MembershipDocument }> {
  const channel = await Channel.findById(channelId);
  if (!channel) throw new AppError(404, 'CHANNEL_NOT_FOUND', 'Channel not found');

  const membership = await Membership.findOne({ workspaceId: channel.workspaceId, userId });
  if (!membership) throw forbidden('You do not have access to this channel');

  if (channel.isPrivate && !channel.memberIds.some((id) => id.equals(userId))) {
    throw forbidden('This channel is private');
  }

  return { channel, membership };
}

/** Is the user a member (any role) of this workspace? */
export async function isWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  return (await Membership.exists({ workspaceId, userId })) !== null;
}

/** Ids of every workspace the user belongs to (for joining presence rooms on connect). */
export async function listWorkspaceIds(userId: string): Promise<string[]> {
  const rows = await Membership.find({ userId }, { workspaceId: 1 }).lean();
  return rows.map((m) => m.workspaceId.toString());
}

/** User ids of every member of the workspace (for the presence list). */
export async function listWorkspaceMemberIds(workspaceId: string): Promise<string[]> {
  const rows = await Membership.find({ workspaceId }, { userId: 1 }).lean();
  return rows.map((m) => m.userId.toString());
}
