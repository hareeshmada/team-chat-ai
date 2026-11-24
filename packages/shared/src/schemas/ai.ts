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

export type AiChatInput = z.infer<typeof aiChatRequestSchema>;
