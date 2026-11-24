import {
  extractMentionIds,
  MENTION_TOKEN,
  NOTIFICATION_EXCERPT_MAX,
  NOTIFICATIONS_UNREAD_CAP,
  publicNotificationSchema,
  type MarkNotificationsReadInput,
  type NotificationsPage,
  type NotificationsQuery,
  type PublicMessage,
  type PublicNotification,
  type Role,
} from '@teamchat/shared';
import { publishNotification } from '../lib/eventBus.js';
import type { ChannelDocument } from '../models/Channel.js';
import { Notification, type NotificationLean } from '../models/Notification.js';
import { User } from '../models/User.js';

/** Max notifications replayed on one reconnect (older ones are still in the list endpoint). */
export const REPLAY_LIMIT = 100;

function toPublicNotification(n: NotificationLean): PublicNotification {
  return publicNotificationSchema.parse({
    id: n._id.toString(),
    type: n.type,
    payload: n.payload,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  });
}

type NewNotification = Pick<PublicNotification, 'type' | 'payload'> & { userId: string };

/**
 * Save first, then publish: a stream only ever sends notifications that exist in the database,
 * so a client that reconnects with Last-Event-ID can always replay them.
 */
async function createNotifications(items: NewNotification[]): Promise<void> {
  if (items.length === 0) return;
  // Payload shapes are checked by TypeScript here, and by the shared schema on the way out.
  const docs = await Notification.insertMany(items);
  for (const doc of docs) {
    publishNotification(
      doc.userId.toString(),
      toPublicNotification(doc.toObject<NotificationLean>()),
    );
  }
}

async function namesOf(userIds: string[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: userIds } }, { name: 1 }).lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

/** Body with <@id> shown as @Name, whitespace collapsed, cut to the excerpt length. */
function excerptOf(body: string, names: Map<string, string>): string {
  const text = body
    .replace(MENTION_TOKEN, (_, id: string) => `@${names.get(id.toLowerCase()) ?? 'unknown'}`)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > NOTIFICATION_EXCERPT_MAX
    ? `${text.slice(0, NOTIFICATION_EXCERPT_MAX - 1)}…`
    : text;
}

/**
 * "X mentioned you in #channel". `message.mentionedUserIds` is already limited to people who can
 * see the channel. Never for yourself; on an edit, only for people who weren't mentioned before
 * (fixing a typo must not ping everyone again).
 */
export async function notifyMentions(
  message: PublicMessage,
  channel: ChannelDocument,
  alreadyMentioned: string[] = [],
): Promise<void> {
  const skip = new Set([message.authorId, ...alreadyMentioned]);
  const recipients = message.mentionedUserIds.filter((id) => !skip.has(id));
  if (recipients.length === 0) return;

  const names = await namesOf([message.authorId, ...extractMentionIds(message.body)]);
  const payload = {
    workspaceId: channel.workspaceId.toString(),
    channelId: message.channelId,
    channelName: channel.name,
    messageId: message.id,
    authorId: message.authorId,
    authorName: names.get(message.authorId) ?? 'unknown',
    excerpt: excerptOf(message.body, names),
  };
  await createNotifications(
    recipients.map((userId) => ({ userId, type: 'mention' as const, payload })),
  );
}

/** "X added you to Y". */
export async function notifyInvite(input: {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  invitedById: string;
  role: Role;
}): Promise<void> {
  if (input.userId === input.invitedById) return;
  const names = await namesOf([input.invitedById]);
  await createNotifications([
    {
      userId: input.userId,
      type: 'invite',
      payload: {
        workspaceId: input.workspaceId,
        workspaceName: input.workspaceName,
        invitedById: input.invitedById,
        invitedByName: names.get(input.invitedById) ?? 'unknown',
        role: input.role,
      },
    },
  ]);
}

const unreadCount = (userId: string) =>
  Notification.countDocuments({ userId, readAt: null }, { limit: NOTIFICATIONS_UNREAD_CAP });

/** Newest first, cursor-paginated (same pattern as message history). */
export async function listNotifications(
  userId: string,
  { before, limit }: NotificationsQuery,
): Promise<NotificationsPage> {
  const rows = await Notification.find({ userId, ...(before && { _id: { $lt: before } }) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<NotificationLean[]>();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    notifications: page.map(toPublicNotification),
    nextCursor: hasMore ? page.at(-1)!._id.toString() : null,
    unreadCount: await unreadCount(userId),
  };
}

/** Replay after a reconnect: everything newer than the last id the client saw, oldest first. */
export async function listSince(userId: string, lastId: string): Promise<PublicNotification[]> {
  const rows = await Notification.find({ userId, _id: { $gt: lastId } })
    .sort({ _id: 1 })
    .limit(REPLAY_LIMIT)
    .lean<NotificationLean[]>();
  return rows.map(toPublicNotification);
}

/** Marks some (or all) of YOUR unread notifications read; returns what is still unread. */
export async function markRead(userId: string, input: MarkNotificationsReadInput): Promise<number> {
  const filter =
    'all' in input ? { userId, readAt: null } : { userId, readAt: null, _id: { $in: input.ids } };
  await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return unreadCount(userId);
}
