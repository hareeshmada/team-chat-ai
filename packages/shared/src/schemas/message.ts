import { z } from 'zod';
import { aiMessageInfoSchema } from './ai.js';
import { objectIdSchema } from './common.js';
import { attachmentSchema } from './upload.js';

export const MESSAGES_PAGE_DEFAULT = 30;
export const MESSAGES_PAGE_MAX = 50;

export const messagesQuerySchema = z.object({
  /** Cursor: return messages older than this message id. */
  before: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGES_PAGE_MAX).default(MESSAGES_PAGE_DEFAULT),
});

/** The six quick reactions (DESIGN "Realtime UI rules"). The server rejects anything else. */
export const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🙏'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];
/** Accessible names for the picker buttons and pills. */
export const REACTION_LABELS: Record<ReactionEmoji, string> = {
  '👍': 'thumbs up',
  '❤️': 'heart',
  '😂': 'laughing',
  '🎉': 'party',
  '👀': 'eyes',
  '🙏': 'thank you',
};
export const reactionEmojiSchema = z.enum(REACTIONS);

export const reactionSchema = z.object({
  emoji: reactionEmojiSchema,
  userIds: z.array(z.string()),
});

export const publicMessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  /**
   * Empty when deleted, and may be empty when the message is only files.
   * Mentions are stored as <@userId> tokens (see mentions.ts).
   */
  body: z.string(),
  /** Uploaded files (Step 5.1); cleared on delete. */
  attachments: z.array(attachmentSchema),
  reactions: z.array(reactionSchema),
  mentionedUserIds: z.array(z.string()),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  /** Soft delete: the row stays (shown as "message deleted"); body, reactions, mentions cleared. */
  deletedAt: z.iso.datetime().nullable(),
  /** Only on messages written by the AI bot (authorId = AI_BOT_ID). */
  ai: aiMessageInfoSchema.optional(),
});

export const messagesPageSchema = z.object({
  /** Newest first. */
  messages: z.array(publicMessageSchema),
  /** Pass as ?before= to load the next (older) page; null when there are no more. */
  nextCursor: z.string().nullable(),
});

export type Reaction = z.infer<typeof reactionSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
export type PublicMessage = z.infer<typeof publicMessageSchema>;
export type MessagesPage = z.infer<typeof messagesPageSchema>;
