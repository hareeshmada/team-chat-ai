import { once } from 'node:events';
import {
  AI_CONVERSATION_HEADER,
  AI_SUMMARY_CONTEXT,
  SUMMARY_HEADERS,
  type AiChatInput,
  type AiFeature,
  type AiConversationsQuery,
} from '@teamchat/shared';
import type { RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import { getChannel } from '../middleware/requireChannelAccess.js';
import {
  AiAbortedError,
  newTokenMeter,
  streamReply,
  SYSTEM_PROMPT,
  type AiTurn,
  type TokenMeter,
} from '../services/ai.service.js';
import {
  assertWithinLimit,
  getUsage,
  recordUsage,
  tokensToCharge,
} from '../services/aiUsage.service.js';
import { notifyAiUsage } from '../socket/realtime.js';
import * as aiConversations from '../services/aiConversation.service.js';
import {
  buildSummaryTurns,
  CHANNEL_SUMMARY_PROMPT,
  loadChannelContext,
} from '../services/channelAi.service.js';

/**
 * res 'close' fires when the response finishes OR the client goes away. Only the second one
 * (not finished yet) means "stop". req 'close' is the wrong event: it can fire as soon as the
 * request body has been read.
 */
function abortOnDisconnect(res: Response) {
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableFinished) controller.abort();
  };
  res.on('close', onClose);
  return { signal: controller.signal, dispose: () => res.off('close', onClose) };
}

/**
 * Backpressure: res.write() returns false when the socket's buffer is full (a slow client).
 * Wait for 'drain' before writing more instead of piling text up in memory. The signal ends the
 * wait if the client disconnects (then 'drain' would never come).
 */
async function writeText(res: Response, text: string, signal: AbortSignal): Promise<void> {
  if (!res.write(text)) await once(res, 'drain', { signal });
}

interface PipeResult {
  answer: string;
  usage: { inputTokens: number; outputTokens: number };
  /** done = finished; aborted = the client left / pressed Stop; failed = broke after text. */
  outcome: 'done' | 'aborted' | 'failed';
  error?: unknown;
}

/**
 * Streams a Gemini answer to `res` as chunked text/plain.
 *
 * Headers go out with the FIRST piece of text, not before: until then an error (quota, bad
 * key, timeout) is thrown, so it becomes a normal JSON error with the right status. After that
 * the status is already 200, so a failure is returned as `failed` and the caller cuts the
 * connection (the client sees a broken read).
 */
async function pipeReply(
  res: Response,
  opts: {
    turns: AiTurn[];
    systemPrompt?: string;
    headers: Record<string, string>;
    signal: AbortSignal;
    /** Who pays for the tokens, and for which feature (Step 4.4). */
    charge: { userId: string; feature: AiFeature };
  },
): Promise<PipeResult> {
  const { turns, systemPrompt = SYSTEM_PROMPT, headers, signal, charge } = opts;
  const meter = newTokenMeter();
  let answer = '';
  let started = false;
  let usage = { inputTokens: 0, outputTokens: 0 };
  // Whatever happens (done, stopped, failed), charge what was used, once.
  const settle = () => chargeUsage(charge, meter, { system: systemPrompt, turns }, answer);
  try {
    for await (const event of streamReply(turns, signal, systemPrompt, meter)) {
      if (event.type === 'usage') {
        usage = event;
        continue;
      }
      if (!started) {
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          // no-transform: proxies must not buffer/compress it; Nginx reads X-Accel-Buffering.
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
          ...headers,
        });
        res.flushHeaders();
        started = true;
      }
      answer += event.text;
      await writeText(res, event.text, signal);
    }
    if (!started) {
      // No text at all (e.g. the model's safety filter blocked the answer).
      throw new AppError(502, 'AI_EMPTY', "The assistant couldn't answer that. Try rephrasing.");
    }
    await settle();
    return { answer, usage, outcome: 'done' };
  } catch (err) {
    await settle();
    if (signal.aborted || err instanceof AiAbortedError)
      return { answer, usage, outcome: 'aborted' };
    if (!started) throw err; // still a normal JSON error response
    return { answer, usage, outcome: 'failed', error: err };
  }
}

/** Adds the call's tokens to the user's daily total and tells their tabs. Never throws. */
async function chargeUsage(
  charge: { userId: string; feature: AiFeature },
  meter: TokenMeter,
  prompt: { system: string; turns: AiTurn[] },
  answer: string,
): Promise<void> {
  const tokens = tokensToCharge(meter, prompt, answer);
  if (!tokens) return;
  try {
    const usage = await recordUsage({ ...charge, ...tokens });
    notifyAiUsage(charge.userId, usage);
  } catch (err) {
    logger.error({ err }, 'recording AI usage failed');
  }
}

/** POST /api/ai/chat: the assistant panel. Streams the answer and saves the exchange. */
export const chat: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  const { conversationId, message } = req.body as AiChatInput;
  await assertWithinLimit(userId); // 429 AI_LIMIT_REACHED before anything costs tokens
  const { signal, dispose } = abortOnDisconnect(res);

  try {
    const { id, history } = await aiConversations.loadConversation(userId, conversationId);
    const startedAt = Date.now();
    const result = await pipeReply(res, {
      turns: [...history, { role: 'user', content: message }],
      headers: { [AI_CONVERSATION_HEADER]: id.toString() },
      signal,
      charge: { userId, feature: 'assistant' },
    });
    const save = (stopped: boolean) =>
      aiConversations.saveExchange({
        id,
        userId,
        question: message,
        answer: result.answer,
        stopped,
      });
    const meta = { conversationId: id.toString(), ms: Date.now() - startedAt };

    if (result.outcome === 'done') {
      // Save before ending, so a client that reloads right after the stream ends finds it.
      await save(false);
      res.end();
      logger.info({ ...meta, ...result.usage }, 'ai answer streamed');
      return;
    }
    // Stopped or broken after some text: keep what the user already saw, marked stopped (so the
    // saved history matches the panel). Never log the text itself: only sizes.
    if (result.answer) {
      await save(true).catch((err: unknown) =>
        logger.error({ err }, 'saving partial answer failed'),
      );
    }
    if (result.outcome === 'aborted') {
      logger.info(
        { ...meta, chars: result.answer.length },
        'ai stream aborted (client disconnected)',
      );
    } else {
      logger.error({ ...meta, err: result.error }, 'ai stream failed mid-answer');
      res.destroy(); // the client's reader errors → it shows "retry"
    }
  } finally {
    dispose();
  }
};

/**
 * POST /api/channels/:channelId/summary: a private catch-up summary of the last 100 messages,
 * streamed like the chat. Not saved; closing the modal aborts it. The headers say what was
 * summarized (count and time range) for the modal's footer.
 */
export const summarize: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  const channel = getChannel(req);
  await assertWithinLimit(userId);
  const context = await loadChannelContext(channel._id, AI_SUMMARY_CONTEXT);
  if (context.count === 0) {
    throw new AppError(422, 'NOTHING_TO_SUMMARIZE', 'There are no messages to summarize yet.');
  }
  const { signal, dispose } = abortOnDisconnect(res);
  const startedAt = Date.now();
  try {
    const result = await pipeReply(res, {
      turns: buildSummaryTurns(channel, context),
      systemPrompt: CHANNEL_SUMMARY_PROMPT,
      headers: {
        [SUMMARY_HEADERS.count]: String(context.count),
        [SUMMARY_HEADERS.from]: context.from!.toISOString(),
        [SUMMARY_HEADERS.to]: context.to!.toISOString(),
      },
      signal,
      charge: { userId, feature: 'summary' },
    });
    const meta = { channelId: channel._id.toString(), ms: Date.now() - startedAt };
    if (result.outcome === 'done') {
      res.end();
      logger.info({ ...meta, ...result.usage }, 'channel summary streamed');
    } else if (result.outcome === 'aborted') {
      logger.info(meta, 'channel summary aborted (client disconnected)');
    } else {
      logger.error({ ...meta, err: result.error }, 'channel summary failed mid-answer');
      res.destroy();
    }
  } finally {
    dispose();
  }
};

export const listConversations: RequestHandler = async (req, res) => {
  const page = await aiConversations.listConversations(
    getAuthUser(req).userId,
    req.query as unknown as AiConversationsQuery,
  );
  res.json(page);
};

export const getConversation: RequestHandler = async (req, res) => {
  const conversation = await aiConversations.getConversation(
    getAuthUser(req).userId,
    req.params.conversationId as string,
  );
  res.json({ conversation });
};

/** GET /api/ai/usage: today's tokens, the limit and when it resets (user menu, panel footer). */
export const usage: RequestHandler = async (req, res) => {
  res.json(await getUsage(getAuthUser(req).userId));
};
