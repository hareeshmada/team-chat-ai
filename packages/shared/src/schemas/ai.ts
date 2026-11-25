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

// ---- AI in channels (Step 4.3) ---------------------------------------------------------------

/**
 * The bot that answers `@ai` in channels is not a user account: its messages carry this fixed
 * author id (no User document, so nobody can log in as it, it's in no member list, and the
 * author checks for edit/delete never match it) plus an `ai` field on the message.
 */
export const AI_BOT_ID = '0000000000000000000000a1';
export const AI_BOT_NAME = 'teamchat-ai';

/** Messages given to the model as context for an `@ai` answer / a channel summary. */
export const AI_CHANNEL_CONTEXT = 30;
export const AI_SUMMARY_CONTEXT = 100;

const AI_QUESTION = /^@ai(?![\w-])/i;

/** A channel message that asks the AI: it starts with "@ai" (not "@aisha"). */
export const isAiQuestion = (body: string) => AI_QUESTION.test(body.trimStart());

/** The question without the leading "@ai". */
export const aiQuestionText = (body: string) => body.trimStart().replace(AI_QUESTION, '').trim();

export const AI_MESSAGE_STATUSES = ['thinking', 'streaming', 'done'] as const;
export type AiMessageStatus = (typeof AI_MESSAGE_STATUSES)[number];

/** On a bot message: who asked, which message asked, and how far the answer is. */
export const aiMessageInfoSchema = z.object({
  askedById: z.string(),
  questionId: z.string(),
  status: z.enum(AI_MESSAGE_STATUSES),
  /** How many channel messages the answer was based on ("based on the last 30 messages"). */
  contextCount: z.number().int(),
});
export type AiMessageInfo = z.infer<typeof aiMessageInfoSchema>;

/** Response headers of POST /api/channels/:id/summary (the body is the streamed text). */
export const SUMMARY_HEADERS = {
  count: 'X-Summary-Count',
  from: 'X-Summary-From',
  to: 'X-Summary-To',
} as const;

// ---- daily usage limit (Step 4.4) -------------------------------------------------------------

/** The 429 code when your daily AI allowance is used up (the error's details are an AiUsage). */
export const AI_LIMIT_REACHED = 'AI_LIMIT_REACHED';

export const AI_FEATURES = ['assistant', 'channel', 'summary'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** GET /api/ai/usage, the `ai:usage` socket event and a 429's details. */
export const aiUsageSchema = z.object({
  /** Tokens (input + output) used today. */
  used: z.number().int(),
  limit: z.number().int(),
  /** When the allowance resets (next midnight in the app's timezone). */
  resetAt: z.iso.datetime(),
  /** True when the counter is unavailable (Redis down): the limit isn't enforced then. */
  degraded: z.boolean().optional(),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;
