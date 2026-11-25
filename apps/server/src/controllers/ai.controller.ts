import { once } from 'node:events';
import {
  AI_CONVERSATION_HEADER,
  AI_SUMMARY_CONTEXT,
  SUMMARY_HEADERS,
  type AiChatInput,
  type AiConversationsQuery,
} from '@teamchat/shared';
import type { RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import { getChannel } from '../middleware/requireChannelAccess.js';
import { AiAbortedError, streamReply, type AiTurn } from '../services/ai.service.js';
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
  turns: AiTurn[],
  systemPrompt: string | undefined,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<PipeResult> {
  let answer = '';
  let started = false;
  let usage = { inputTokens: 0, outputTokens: 0 };
  try {
    for await (const event of streamReply(turns, signal, systemPrompt)) {
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
    return { answer, usage, outcome: 'done' };
  } catch (err) {
    if (signal.aborted || err instanceof AiAbortedError)
      return { answer, usage, outcome: 'aborted' };
    if (!started) throw err; // still a normal JSON error response
    return { answer, usage, outcome: 'failed', error: err };
  }
}

/** POST /api/ai/chat: the assistant panel. Streams the answer and saves the exchange. */
export const chat: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  const { conversationId, message } = req.body as AiChatInput;
  const { signal, dispose } = abortOnDisconnect(res);

  try {
    const { id, history } = await aiConversations.loadConversation(userId, conversationId);
    const startedAt = Date.now();
    const result = await pipeReply(
      res,
      [...history, { role: 'user', content: message }],
      undefined,
      { [AI_CONVERSATION_HEADER]: id.toString() },
      signal,
    );
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
  const channel = getChannel(req);
  const context = await loadChannelContext(channel._id, AI_SUMMARY_CONTEXT);
  if (context.count === 0) {
    throw new AppError(422, 'NOTHING_TO_SUMMARIZE', 'There are no messages to summarize yet.');
  }
  const { signal, dispose } = abortOnDisconnect(res);
  const startedAt = Date.now();
  try {
    const result = await pipeReply(
      res,
      buildSummaryTurns(channel, context),
      CHANNEL_SUMMARY_PROMPT,
      {
        [SUMMARY_HEADERS.count]: String(context.count),
        [SUMMARY_HEADERS.from]: context.from!.toISOString(),
        [SUMMARY_HEADERS.to]: context.to!.toISOString(),
      },
      signal,
    );
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
