import { z } from 'zod';
import { objectIdSchema } from './common.js';
import { roleSchema } from './workspace.js';

export const NOTIFICATION_TYPES = ['mention', 'invite', 'ai_done', 'system'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATIONS_PAGE_DEFAULT = 20;
export const NOTIFICATIONS_PAGE_MAX = 50;
/** The bell shows "9+"; the server counts up to this so the number stays cheap. */
export const NOTIFICATIONS_UNREAD_CAP = 100;
/** Mention excerpts are cut to this many characters. */
export const NOTIFICATION_EXCERPT_MAX = 140;

/**
 * Payloads keep a COPY of the names and text needed to render the item ("meera mentioned you
 * in #frontend"), so the list needs no joins. A later rename doesn't change old notifications.
 */
export const mentionPayloadSchema = z.object({
  workspaceId: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  messageId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  /** Message text with <@id> tokens shown as @Name, cut to NOTIFICATION_EXCERPT_MAX. */
  excerpt: z.string(),
});

export const invitePayloadSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string(),
  invitedById: z.string(),
  invitedByName: z.string(),
  role: roleSchema,
});

/** ai_done (Day 4) and system notifications: a title, a line of text, an optional app link. */
export const messagePayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  link: z.string().optional(),
});

const base = {
  id: z.string(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
};

export const publicNotificationSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('mention'), payload: mentionPayloadSchema }),
  z.object({ ...base, type: z.literal('invite'), payload: invitePayloadSchema }),
  z.object({ ...base, type: z.literal('ai_done'), payload: messagePayloadSchema }),
  z.object({ ...base, type: z.literal('system'), payload: messagePayloadSchema }),
]);

export const notificationsQuerySchema = z.object({
  /** Cursor: notifications older than this id. */
  before: objectIdSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(NOTIFICATIONS_PAGE_MAX)
    .default(NOTIFICATIONS_PAGE_DEFAULT),
});

export const notificationsPageSchema = z.object({
  /** Newest first. */
  notifications: z.array(publicNotificationSchema),
  nextCursor: z.string().nullable(),
  /** Unread notifications in total (capped at NOTIFICATIONS_UNREAD_CAP). */
  unreadCount: z.number().int(),
});

/** Either specific ids, or everything. */
export const markNotificationsReadSchema = z.union([
  z.object({ ids: z.array(objectIdSchema).min(1).max(100) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

export const markNotificationsReadResponseSchema = z.object({ unreadCount: z.number().int() });

export const streamTicketResponseSchema = z.object({
  ticket: z.string(),
  expiresAt: z.iso.datetime(),
});

export const notificationStreamQuerySchema = z.object({
  ticket: z.string().min(1).max(200),
  /**
   * Same meaning as the Last-Event-ID header. Needed because a reconnect with a fresh ticket is
   * a NEW EventSource, and EventSource can't set that header itself.
   */
  lastEventId: objectIdSchema.optional(),
});

/** SSE event names on the stream. */
export const SSE_EVENTS = { notification: 'notification', read: 'read' } as const;

/**
 * `event: read` (no id, not replayed): some of your notifications were marked read, in this or
 * another tab, or by reading the channel a mention is in. `ids: null` = all of them.
 */
export const notificationsReadEventSchema = z.object({
  ids: z.array(z.string()).nullable(),
  unreadCount: z.number().int(),
});

export type MentionPayload = z.infer<typeof mentionPayloadSchema>;
export type InvitePayload = z.infer<typeof invitePayloadSchema>;
export type PublicNotification = z.infer<typeof publicNotificationSchema>;
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
export type NotificationsReadEvent = z.infer<typeof notificationsReadEventSchema>;
