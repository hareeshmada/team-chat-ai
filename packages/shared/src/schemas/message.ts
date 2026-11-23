import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const MESSAGES_PAGE_DEFAULT = 30;
export const MESSAGES_PAGE_MAX = 50;

export const messagesQuerySchema = z.object({
  /** Cursor: return messages older than this message id. */
  before: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGES_PAGE_MAX).default(MESSAGES_PAGE_DEFAULT),
});

export const attachmentSchema = z.object({
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
});

export const publicMessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  body: z.string(),
  attachments: z.array(attachmentSchema),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
});

export const messagesPageSchema = z.object({
  /** Newest first. */
  messages: z.array(publicMessageSchema),
  /** Pass as ?before= to load the next (older) page; null when there are no more. */
  nextCursor: z.string().nullable(),
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
export type PublicMessage = z.infer<typeof publicMessageSchema>;
export type MessagesPage = z.infer<typeof messagesPageSchema>;
