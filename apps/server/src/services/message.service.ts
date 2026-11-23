import type { MessagesPage, MessagesQuery, PublicMessage } from '@teamchat/shared';
import { Message, type MessageAttrs } from '../models/Message.js';
import type { Types } from 'mongoose';

type MessageLean = MessageAttrs & { _id: Types.ObjectId; createdAt: Date };

function toPublicMessage(m: MessageLean): PublicMessage {
  return {
    id: m._id.toString(),
    channelId: m.channelId.toString(),
    authorId: m.authorId.toString(),
    body: m.body,
    attachments: m.attachments.map(({ url, name, mimeType, size }) => ({
      url,
      name,
      mimeType,
      size,
    })),
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
  };
}

/**
 * Cursor pagination, newest first. The cursor is the last message id of the previous page:
 * "_id < before" instead of skip(n), so MongoDB seeks straight to it in the
 * { channelId: 1, _id: -1 } index, and new messages arriving between pages can't shift or
 * duplicate results. One extra row is fetched to know whether another page exists.
 */
export async function listMessages(
  channelId: Types.ObjectId,
  { before, limit }: MessagesQuery,
): Promise<MessagesPage> {
  const rows = await Message.find({ channelId, ...(before && { _id: { $lt: before } }) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<MessageLean[]>();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    messages: page.map(toPublicMessage),
    nextCursor: hasMore ? page[page.length - 1]!._id.toString() : null,
  };
}
