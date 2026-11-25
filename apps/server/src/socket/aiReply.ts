import { AI_CHANNEL_CONTEXT, SOCKET_EVENTS, type SocketError } from '@teamchat/shared';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import type { ChannelDocument } from '../models/Channel.js';
import { newTokenMeter, streamReply, type AiTurn } from '../services/ai.service.js';
import { assertWithinLimit, recordUsage, tokensToCharge } from '../services/aiUsage.service.js';
import {
  buildAnswerTurns,
  CHANNEL_ANSWER_PROMPT,
  createAiPlaceholder,
  finishAiMessage,
  loadChannelContext,
  removeAiPlaceholder,
  saveAiProgress,
  userName,
} from '../services/channelAi.service.js';
import { notifyAiUsage, notifyChannelActivity } from './realtime.js';
import { channelRoom, userRoom, type IoServer } from './types.js';

/** Mutable so tests can save progress more often. */
export const aiReplyConfig = {
  /** Save the partial answer this often, for people who open the channel mid-answer. */
  saveEveryMs: 2_000,
};

/** Users with an `@ai` answer in progress: one at a time each (in memory; Redis on Day 5). */
const running = new Set<string>();

export const aiRepliesRunning = () => running.size;

function toSocketError(err: unknown): SocketError {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  return { code: 'AI_ERROR', message: 'The assistant could not answer. Try again.' };
}

/**
 * Answers an `@ai` question in a channel, streaming to everyone in the channel room:
 *
 * 1. a placeholder bot message ("thinking") via message:new;
 * 2. ai:chunk { delta, offset } for every piece of text (the same stream reaches every member:
 *    one Gemini call, fanned out by the room);
 * 3. message:updated with the final text (status "done").
 *
 * On failure the placeholder is deleted and ai:failed tells the room (to drop it) and the asker
 * (to show the error with a retry). Never throws: it runs after the send was acked.
 */
export async function runAiReply(
  io: IoServer,
  channel: ChannelDocument,
  question: { id: string; body: string },
  askerId: string,
): Promise<void> {
  const channelId = channel._id.toString();
  const failed = (messageId: string | null, err: unknown) =>
    io.to([channelRoom(channelId), userRoom(askerId)]).emit(SOCKET_EVENTS.aiFailed, {
      channelId,
      messageId,
      questionId: question.id,
      askedById: askerId,
      error: toSocketError(err),
    });

  // Over today's allowance: no placeholder, the asker sees the limit row (their message was
  // still sent).
  try {
    await assertWithinLimit(askerId);
  } catch (err) {
    failed(null, err);
    return;
  }

  if (running.has(askerId)) {
    failed(
      null,
      new AppError(
        429,
        'AI_BUSY',
        'You already have an answer in progress. Wait for it to finish.',
      ),
    );
    return;
  }
  running.add(askerId);

  let placeholderId: string | null = null;
  let turns: AiTurn[] = [];
  let answer = '';
  const meter = newTokenMeter();
  let saveTimer: ReturnType<typeof setInterval> | undefined;
  const startedAt = Date.now();
  try {
    const placeholder = await createAiPlaceholder(channel, askerId, question.id);
    placeholderId = placeholder.id;
    io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.messageNew, {
      message: placeholder,
      tempId: `ai:${placeholder.id}`,
    });
    notifyChannelActivity(channel, placeholder);

    const [context, askerName] = await Promise.all([
      // Up to the question: messages posted after it aren't part of what was asked about.
      loadChannelContext(channel._id, AI_CHANNEL_CONTEXT, new Types.ObjectId(question.id)),
      userName(askerId),
    ]);
    turns = buildAnswerTurns(channel, context, askerName, question.body);

    let saved = '';
    saveTimer = setInterval(() => {
      if (answer === saved) return;
      saved = answer;
      saveAiProgress(placeholder.id, answer).catch((err: unknown) =>
        logger.warn({ err }, 'saving @ai progress failed'),
      );
    }, aiReplyConfig.saveEveryMs);

    // Nobody "owns" this stream (everyone in the channel watches), so there is no Stop: the
    // service's timeouts end a stalled answer.
    const signal = new AbortController().signal;
    let usage = { inputTokens: 0, outputTokens: 0 };
    for await (const event of streamReply(turns, signal, CHANNEL_ANSWER_PROMPT, meter)) {
      if (event.type === 'usage') {
        usage = event;
        continue;
      }
      const offset = answer.length;
      answer += event.text;
      io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.aiChunk, {
        channelId,
        messageId: placeholder.id,
        delta: event.text,
        offset,
      });
    }
    clearInterval(saveTimer);
    if (!answer) {
      throw new AppError(502, 'AI_EMPTY', "The assistant couldn't answer that. Try rephrasing.");
    }

    const final = await finishAiMessage(placeholder.id, answer, context.count);
    if (final) io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.messageUpdated, { message: final });
    logger.info(
      { channelId, messageId: placeholder.id, ...usage, ms: Date.now() - startedAt },
      '@ai answer streamed',
    );
  } catch (err) {
    clearInterval(saveTimer);
    logger.warn({ err, channelId }, '@ai answer failed');
    if (placeholderId) {
      await removeAiPlaceholder(placeholderId).catch((removeErr: unknown) =>
        logger.error({ err: removeErr }, 'removing @ai placeholder failed'),
      );
    }
    failed(placeholderId, err);
  } finally {
    running.delete(askerId);
    // The asker pays for the answer (done or failed), and their tabs' meters update.
    const tokens = tokensToCharge(meter, { system: CHANNEL_ANSWER_PROMPT, turns }, answer);
    if (tokens) {
      await recordUsage({ userId: askerId, feature: 'channel', ...tokens })
        .then((usage) => notifyAiUsage(askerId, usage))
        .catch((err: unknown) => logger.error({ err }, 'recording AI usage failed'));
    }
  }
}
