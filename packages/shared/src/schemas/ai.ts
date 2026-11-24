import { z } from 'zod';
import { objectIdSchema } from './common.js';

/** Longest question the assistant accepts (characters). */
export const AI_MESSAGE_MAX = 4000;

/**
 * POST /api/ai/chat answers with a plain-text stream, so metadata can't go in the body:
 * the conversation id (new or existing) comes back in this response header.
 */
export const AI_CONVERSATION_HEADER = 'X-Conversation-Id';

export const aiChatRequestSchema = z.object({
  /** Omit to start a new conversation. */
  conversationId: objectIdSchema.optional(),
  message: z.string().trim().min(1, 'Message is required').max(AI_MESSAGE_MAX),
});

export const AI_ROLES = ['user', 'assistant'] as const;
export type AiRole = (typeof AI_ROLES)[number];

export const aiMessageSchema = z.object({
  role: z.enum(AI_ROLES),
  content: z.string(),
  /** The answer was stopped before it finished (content is partial). */
  stopped: z.boolean().optional(),
  createdAt: z.string(),
});

/** One row of "past conversations". */
export const aiConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  messageCount: z.number().int(),
  updatedAt: z.string(),
});

export const aiConversationSchema = aiConversationSummarySchema.extend({
  messages: z.array(aiMessageSchema),
});

export const AI_CONVERSATIONS_PAGE_DEFAULT = 20;
export const AI_CONVERSATIONS_PAGE_MAX = 50;

/**
 * The list is ordered by `updatedAt` (a follow-up moves a conversation to the top), so the
 * cursor is `<updatedAt ms>_<id>`: the id breaks ties between equal timestamps.
 */
export const aiConversationCursorSchema = z
  .string()
  .regex(/^\d{1,15}_[a-f\d]{24}$/i, 'Invalid cursor');

export const aiConversationsQuerySchema = z.object({
  before: aiConversationCursorSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(AI_CONVERSATIONS_PAGE_MAX)
    .default(AI_CONVERSATIONS_PAGE_DEFAULT),
});

export const aiConversationsPageSchema = z.object({
  conversations: z.array(aiConversationSummarySchema),
  /** Pass as ?before= for the next (older) page; null when there are no more. */
  nextCursor: z.string().nullable(),
});

export const aiConversationResponseSchema = z.object({ conversation: aiConversationSchema });
export const aiConversationParamsSchema = z.object({ conversationId: objectIdSchema });

export type AiChatInput = z.infer<typeof aiChatRequestSchema>;
export type AiMessage = z.infer<typeof aiMessageSchema>;
export type AiConversationSummary = z.infer<typeof aiConversationSummarySchema>;
export type PublicAiConversation = z.infer<typeof aiConversationSchema>;
export type AiConversationsQuery = z.infer<typeof aiConversationsQuerySchema>;
export type AiConversationsPage = z.infer<typeof aiConversationsPageSchema>;
