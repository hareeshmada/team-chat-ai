import { extractMentionIds } from '@teamchat/shared';
import { Types } from 'mongoose';
import type { ChannelDocument } from '../models/Channel.js';
import { Membership } from '../models/Membership.js';

/**
 * Turns the <@userId> tokens in a body into the ids of users who can actually see the channel:
 * workspace members for a public channel, the channel's memberIds for a private one. Anything
 * else (a made-up id, someone outside the workspace) is dropped, so a mention can never be used
 * to notify or reveal a channel to an outsider.
 */
export async function resolveMentions(
  channel: ChannelDocument,
  body: string,
): Promise<Types.ObjectId[]> {
  const ids = extractMentionIds(body);
  if (ids.length === 0) return [];

  if (channel.isPrivate) {
    const members = new Set(channel.memberIds.map((id) => id.toString()));
    return ids.filter((id) => members.has(id)).map((id) => new Types.ObjectId(id));
  }

  const rows = await Membership.find(
    { workspaceId: channel.workspaceId, userId: { $in: ids } },
    { userId: 1 },
  ).lean();
  const members = new Set(rows.map((m) => m.userId.toString()));
  // Keep the order of first appearance in the text.
  return ids.filter((id) => members.has(id)).map((id) => new Types.ObjectId(id));
}
