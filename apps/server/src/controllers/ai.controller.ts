import { once } from 'node:events';
import {
  AI_CONVERSATION_HEADER,
  type AiChatInput,
  type AiConversationsQuery,
} from '@teamchat/shared';
import type { RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import { AiAbortedError, streamReply } from '../services/ai.service.js';
import * as aiConversations from '../services/aiConversation.service.js';

/**
 * Backpressure: res.write() returns false when the socket's buffer is full (a slow client).
 * Wait for 'drain' before writing more instead of piling text up in memory. The signal ends the
 * wait if the client disconnects (then 'drain' would never come).
 */
async function writeText(res: Response, text: string, signal: AbortSignal): Promise<void> {
  if (!res.write(text)) await once(res, 'drain', { signal });
}

function startStream(res: Response, conversationId: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    [AI_CONVERSATION_HEADER]: conversationId,
    // no-transform: proxies must not buffer/compress it; Nginx reads X-Accel-Buffering (Day 7).
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
}

/**
 * POST /api/ai/chat: streams the answer as chunked text/plain while Gemini writes it.
 *
 * Headers go out with the FIRST piece of text, not before: until then an error (quota, bad
 * key, timeout) can still be a normal JSON error with the right status. After that the status
 * is already 200, so a failure can only cut the connection (the client sees a broken read).
 */
export const chat: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  const { conversationId, message } = req.body as AiChatInput;

  // res 'close' fires when the response finishes OR the client goes away. Only the second one
  // (not finished yet) means "stop". req 'close' is the wrong event: it can fire as soon as the
  // request body has been read.
  const abort = new AbortController();
  const onClose = () => {
    if (!res.writableFinished) abort.abort();
  };
  res.on('close', onClose);

  const { id, history } = await aiConversations.loadConversation(userId, conversationId);
  const startedAt = Date.now();
  let answer = '';
  let started = false;
  let usage = { inputTokens: 0, outputTokens: 0 };

  try {
    for await (const event of streamReply(
      [...history, { role: 'user', content: message }],
      abort.signal,
    )) {
      if (event.type === 'usage') {
        usage = event;
        continue;
      }
      if (!started) {
        startStream(res, id.toString());
        started = true;
      }
      answer += event.text;
      await writeText(res, event.text, abort.signal);
    }
    if (!started) {
      // No text at all (e.g. the model's safety filter blocked the answer).
      throw new AppError(502, 'AI_EMPTY', "The assistant couldn't answer that. Try rephrasing.");
    }
    // Save before ending, so a client that reloads right after the stream ends finds it.
    await aiConversations.saveExchange({ id, userId, question: message, answer, stopped: false });
    res.end();
    logger.info(
      { conversationId: id.toString(), ...usage, ms: Date.now() - startedAt },
      'ai answer streamed',
    );
  } catch (err) {
    if (abort.signal.aborted || err instanceof AiAbortedError) {
      // Never log the text itself: only sizes.
      logger.info(
        { conversationId: id.toString(), chars: answer.length, ms: Date.now() - startedAt },
        'ai stream aborted (client disconnected)',
      );
      if (answer)
        await aiConversations.saveExchange({
          id,
          userId,
          question: message,
          answer,
          stopped: true,
        });
      return;
    }
    if (!started) throw err; // still a normal JSON error response
    logger.error({ err, conversationId: id.toString() }, 'ai stream failed mid-answer');
    // Keep what the user already saw (as for a disconnect), so the saved history matches the
    // panel: partial answer marked stopped, and Retry adds a new exchange after it.
    await aiConversations
      .saveExchange({ id, userId, question: message, answer, stopped: true })
      .catch((saveErr: unknown) => logger.error({ err: saveErr }, 'saving partial answer failed'));
    res.destroy(); // the client's reader errors → it shows "retry"
  } finally {
    res.off('close', onClose);
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
