import { Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { AiConversation } from '../models/AiConversation.js';
import type { AiTurn } from './ai.service.js';

/** Follow-up questions send this many earlier messages as context (bounds tokens per call). */
export const AI_HISTORY_LIMIT = 20;
const TITLE_MAX = 80;

export interface LoadedConversation {
  id: Types.ObjectId;
  /** The last AI_HISTORY_LIMIT messages, oldest first (empty for a new conversation). */
  history: AiTurn[];
}

/**
 * An existing conversation of yours, or a fresh id for a new one (saved only once the first
 * answer is saved, so a failed first question leaves nothing behind). Someone else's id → 404,
 * the same as an id that doesn't exist.
 */
export async function loadConversation(
  userId: string,
  conversationId: string | undefined,
): Promise<LoadedConversation> {
  if (!conversationId) return { id: new Types.ObjectId(), history: [] };
  const conversation = await AiConversation.findOne(
    { _id: conversationId, userId },
    { messages: { $slice: -AI_HISTORY_LIMIT } },
  ).lean();
  if (!conversation) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
  return {
    id: conversation._id,
    history: conversation.messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

const makeTitle = (question: string) => {
  const oneLine = question.replace(/\s+/g, ' ').trim();
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1)}…` : oneLine;
};

/**
 * Saves a question and its answer together (one upsert: creates the conversation on the first
 * exchange). `stopped` marks an answer cut short by the user.
 */
export async function saveExchange(input: {
  id: Types.ObjectId;
  userId: string;
  question: string;
  answer: string;
  stopped: boolean;
}): Promise<void> {
  const now = new Date();
  await AiConversation.updateOne(
    { _id: input.id, userId: input.userId },
    {
      $setOnInsert: { title: makeTitle(input.question) },
      $push: {
        messages: {
          $each: [
            { role: 'user', content: input.question, createdAt: now },
            {
              role: 'assistant',
              content: input.answer,
              createdAt: now,
              ...(input.stopped && { stopped: true }),
            },
          ],
        },
      },
    },
    { upsert: true },
  );
}
