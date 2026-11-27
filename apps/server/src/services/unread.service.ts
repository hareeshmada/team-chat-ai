import { UNREAD_CAP, type ChannelUnread } from '@teamchat/shared';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { Channel, type ChannelDocument } from '../models/Channel.js';
import { ChannelRead } from '../models/ChannelRead.js';
import { Message } from '../models/Message.js';
import { listWorkspaceIds } from './access.service.js';

/**
 * Unread counts for every channel the user can see, across all their workspaces.
 *
 * Cheap because of the read marker: "unread" = messages in the channel with _id greater than
 * lastReadMessageId, from someone else, not deleted. That is a range scan on the existing
 * { channelId: 1, _id: -1 } index, and `limit: UNREAD_CAP` stops each count after 100 matches,
 * so a channel with 50 000 unread messages costs the same as one with 100 (the UI shows "99+").
 * No per-message "read by" arrays, no write per message per reader.
 */
export async function listUnread(userId: string): Promise<ChannelUnread[]> {
  const uid = new Types.ObjectId(userId);
  const workspaceIds = await listWorkspaceIds(userId);
  if (workspaceIds.length === 0) return [];

  const channels = await Channel.find(
    { workspaceId: { $in: workspaceIds }, $or: [{ isPrivate: false }, { memberIds: uid }] },
    { workspaceId: 1 },
  ).lean();
  const reads = await ChannelRead.find(
    { userId: uid, channelId: { $in: channels.map((c) => c._id) } },
    { channelId: 1, lastReadMessageId: 1 },
  ).lean();
  const lastRead = new Map(reads.map((r) => [r.channelId.toString(), r.lastReadMessageId]));

  return Promise.all(
    channels.map(async (channel) => {
      const marker = lastRead.get(channel._id.toString());
      const filter = {
        channelId: channel._id,
        authorId: { $ne: uid },
        deletedAt: null,
        ...(marker && { _id: { $gt: marker } }),
      };
      const count = await Message.countDocuments(filter, { limit: UNREAD_CAP });
      const mentionCount =
        count === 0
          ? 0
          : await Message.countDocuments(
              { ...filter, mentionedUserIds: uid },
              { limit: UNREAD_CAP },
            );
      return {
        channelId: channel._id.toString(),
        workspaceId: channel.workspaceId.toString(),
        count,
        mentionCount,
        lastReadMessageId: marker?.toString() ?? null,
      };
    }),
  );
}

/**
 * Moves the user's read marker in this channel to `messageId`, never backwards: `$max` keeps
 * the larger ObjectId, so two tabs (or a late request) racing can't un-read newer messages.
 * The upsert creates the marker on first read. Returns the marker after the update.
 */
export async function markRead(
  userId: string,
  channel: ChannelDocument,
  messageId: string,
): Promise<string> {
  const exists = await Message.exists({ _id: messageId, channelId: channel._id });
  if (!exists) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found in this channel');

  const read = await ChannelRead.findOneAndUpdate(
    { userId, channelId: channel._id },
    { $max: { lastReadMessageId: new Types.ObjectId(messageId) } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  return read!.lastReadMessageId.toString();
}
