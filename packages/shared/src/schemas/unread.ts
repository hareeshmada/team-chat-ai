import { z } from 'zod';
import { objectIdSchema } from './common.js';

/** Counts stop here; the UI shows "99+". Keeps each count query bounded. */
export const UNREAD_CAP = 100;

export const channelUnreadSchema = z.object({
  channelId: z.string(),
  workspaceId: z.string(),
  /** Messages from others after your read marker (not deleted), capped at UNREAD_CAP. */
  count: z.number().int(),
  /** How many of those mention you (same cap). */
  mentionCount: z.number().int(),
  /** Null when you have never opened the channel. */
  lastReadMessageId: z.string().nullable(),
});

export const unreadResponseSchema = z.object({ channels: z.array(channelUnreadSchema) });

export const markReadSchema = z.object({ messageId: objectIdSchema });
export const markReadResponseSchema = z.object({ lastReadMessageId: z.string() });

export type ChannelUnread = z.infer<typeof channelUnreadSchema>;
export type UnreadResponse = z.infer<typeof unreadResponseSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
