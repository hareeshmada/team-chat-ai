import {
  firstLink,
  isAiQuestion,
  type MessagesPage,
  type MessagesQuery,
  type PublicMessage,
  type Reaction,
  type ReactionEmoji,
} from '@teamchat/shared';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { isDuplicateKeyError } from '../lib/mongoErrors.js';
import type { ChannelDocument } from '../models/Channel.js';
import { Message, type MessageAttrs } from '../models/Message.js';
import { assertChannelAccess, forbidden } from './access.service.js';
import { resolveMentions } from './mention.service.js';
import { removeFiles, type StoredAttachment } from './upload.service.js';

export type MessageLean = MessageAttrs & { _id: Types.ObjectId; createdAt: Date };

const ids = (list: Types.ObjectId[]) => list.map((id) => id.toString());

// `?? []` / `?? null` below: messages saved before Step 3.1 don't have these fields, and lean()
// queries return the raw document (Mongoose defaults are NOT applied to lean results).
function toPublicReactions(reactions: MessageAttrs['reactions'] | undefined): Reaction[] {
  return (reactions ?? []).map((r) => ({
    emoji: r.emoji as ReactionEmoji,
    userIds: ids(r.userIds),
  }));
}

export function toPublicMessage(m: MessageLean): PublicMessage {
  return {
    id: m._id.toString(),
    channelId: m.channelId.toString(),
    authorId: m.authorId.toString(),
    body: m.body,
    // The public id stays on the server (only needed to delete the file).
    attachments: (m.attachments ?? []).map(
      ({ url, kind, name, mimeType, size, width, height }) => ({
        url,
        kind,
        name,
        mimeType,
        size,
        ...(width != null && height != null && { width, height }),
      }),
    ),
    reactions: toPublicReactions(m.reactions),
    ...(m.linkPreview && {
      linkPreview: {
        url: m.linkPreview.url,
        domain: m.linkPreview.domain,
        title: m.linkPreview.title,
        ...(m.linkPreview.description && { description: m.linkPreview.description }),
        ...(m.linkPreview.imageUrl && { imageUrl: m.linkPreview.imageUrl }),
      },
    }),
    mentionedUserIds: ids(m.mentionedUserIds ?? []),
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    ...(m.ai && {
      ai: {
        askedById: m.ai.askedById.toString(),
        questionId: m.ai.questionId.toString(),
        status: m.ai.status,
        contextCount: m.ai.contextCount,
      },
    }),
  };
}

const notFound = () => new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found');
const alreadyDeleted = () => new AppError(409, 'MESSAGE_DELETED', 'This message was deleted');

/**
 * Cursor pagination, newest first. The cursor is the last message id of the previous page:
 * "_id < before" instead of skip(n), so MongoDB seeks straight to it in the
 * { channelId: 1, _id: -1 } index, and new messages arriving between pages can't shift or
 * duplicate results. One extra row is fetched to know whether another page exists.
 * Deleted messages are included: the UI shows a "message deleted" placeholder.
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

/**
 * Saves a new message (body already validated and trimmed; attachments already checked at
 * Cloudinary by resolveAttachments) and returns its public shape.
 */
export async function createMessage(
  channel: ChannelDocument,
  authorId: string,
  body: string,
  attachments: StoredAttachment[] = [],
): Promise<PublicMessage> {
  const mentionedUserIds = await resolveMentions(channel, body);
  try {
    const message = await Message.create({
      channelId: channel._id,
      authorId,
      body,
      mentionedUserIds,
      attachments,
    });
    return toPublicMessage(message.toObject<MessageLean>());
  } catch (err) {
    // The unique index on attachments.publicId: this file is already on another message.
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'ATTACHMENT_ALREADY_SENT', 'That file was already sent');
    }
    throw err;
  }
}

/**
 * Loads a message for an action by `userId`: it must exist (404) and the user must still have
 * access to its channel (403, same rule as sending). `authorOnly` adds the ownership check.
 */
async function loadForAction(userId: string, messageId: string, authorOnly: boolean) {
  const message = await Message.findById(messageId).lean<MessageLean>();
  if (!message) throw notFound();
  const { channel } = await assertChannelAccess(userId, message.channelId.toString());
  if (authorOnly && !message.authorId.equals(userId)) {
    throw forbidden('You can only change your own messages');
  }
  return { message, channel };
}

/**
 * Author only. Re-parses mentions; an unchanged body is a no-op (not marked as edited).
 * If the edit changes the first link, the old preview is removed (the caller queues a new one).
 */
export async function editMessage(
  userId: string,
  messageId: string,
  body: string,
): Promise<{ message: PublicMessage; channel: ChannelDocument; previouslyMentioned: string[] }> {
  const { message, channel } = await loadForAction(userId, messageId, true);
  if (message.deletedAt) throw alreadyDeleted();
  const previouslyMentioned = ids(message.mentionedUserIds ?? []);
  if (message.body === body) {
    return { message: toPublicMessage(message), channel, previouslyMentioned };
  }

  const mentionedUserIds = await resolveMentions(channel, body);
  const linkChanged = firstLink(message.body) !== firstLink(body);
  // `deletedAt: null` in the filter: a delete that lands between the read and this write wins.
  const updated = await Message.findOneAndUpdate(
    { _id: messageId, deletedAt: null },
    {
      $set: { body, mentionedUserIds, editedAt: new Date() },
      ...(linkChanged && { $unset: { linkPreview: 1 } }),
    },
    { returnDocument: 'after' },
  ).lean<MessageLean>();
  if (!updated) throw alreadyDeleted();
  return { message: toPublicMessage(updated), channel, previouslyMentioned };
}

/**
 * Author only. Soft delete: the row stays so replies around it still make sense, but the text,
 * reactions, mentions, attachments and link preview are removed. Deleting twice is a no-op (safe to retry).
 * The files are then deleted from Cloudinary too (in the background, best effort).
 */
export async function deleteMessage(userId: string, messageId: string): Promise<PublicMessage> {
  const { message } = await loadForAction(userId, messageId, true);
  if (message.deletedAt) return toPublicMessage(message);

  const updated = await Message.findOneAndUpdate(
    { _id: messageId, deletedAt: null },
    {
      $set: {
        deletedAt: new Date(),
        body: '',
        reactions: [],
        mentionedUserIds: [],
        attachments: [],
      },
      $unset: { linkPreview: 1 },
    },
    { returnDocument: 'after' },
  ).lean<MessageLean>();
  // Only the request whose update actually deleted the message removes the files.
  if (updated) removeFiles((message.attachments ?? []).map((a) => a.publicId));
  return toPublicMessage(updated ?? (await Message.findById(messageId).lean<MessageLean>())!);
}

/**
 * Adds the user's reaction, or removes it if it's already there. Each step is ONE conditional
 * update, never read → change → save: two people reacting at the same moment would otherwise
 * overwrite each other's array. Returns the message's reactions after the change.
 */
export async function toggleReaction(
  userId: string,
  messageId: string,
  emoji: ReactionEmoji,
): Promise<{ channelId: string; reactions: Reaction[] }> {
  const { message } = await loadForAction(userId, messageId, false);
  if (message.deletedAt) throw alreadyDeleted();
  const uid = new Types.ObjectId(userId);
  const live = { _id: message._id, deletedAt: null };

  // 1. Already reacted with this emoji → remove the user, then drop entries left empty.
  const removed = await Message.updateOne(
    { ...live, reactions: { $elemMatch: { emoji, userIds: uid } } },
    { $pull: { 'reactions.$.userIds': uid } },
  );
  if (removed.modifiedCount > 0) {
    await Message.updateOne(
      { _id: message._id },
      { $pull: { reactions: { userIds: { $size: 0 } } } },
    );
  } else {
    // 2. The emoji exists → add the user to it ($addToSet: a double click can't add twice).
    const added = await Message.updateOne(
      { ...live, 'reactions.emoji': emoji },
      { $addToSet: { 'reactions.$.userIds': uid } },
    );
    if (added.matchedCount === 0) {
      // 3. New emoji → push an entry, only if nobody pushed the same emoji in the meantime.
      const pushed = await Message.updateOne(
        { ...live, 'reactions.emoji': { $ne: emoji } },
        { $push: { reactions: { emoji, userIds: [uid] } } },
      );
      if (pushed.matchedCount === 0) {
        // Lost the race to another user's push (or the message was just deleted): join theirs.
        await Message.updateOne(
          { ...live, 'reactions.emoji': emoji },
          { $addToSet: { 'reactions.$.userIds': uid } },
        );
      }
    }
  }

  const after = await Message.findById(message._id, { reactions: 1, deletedAt: 1 }).lean();
  if (!after || after.deletedAt) throw alreadyDeleted();
  return { channelId: message.channelId.toString(), reactions: toPublicReactions(after.reactions) };
}

/** One of YOUR `@ai` messages that still exists (for ai:retry); anything else → 404. */
export async function getOwnAiQuestion(userId: string, questionId: string): Promise<PublicMessage> {
  const m = await Message.findById(questionId).lean<MessageLean>();
  if (!m || m.deletedAt || m.authorId.toString() !== userId || !isAiQuestion(m.body)) {
    throw notFound();
  }
  return toPublicMessage(m);
}

/** One message by id in its public shape (null if it doesn't exist). */
export async function getPublicMessage(messageId: string): Promise<PublicMessage | null> {
  const m = await Message.findById(messageId).lean<MessageLean>();
  return m ? toPublicMessage(m) : null;
}
