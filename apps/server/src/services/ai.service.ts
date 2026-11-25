import { ApiError, GoogleGenAI, type Content } from '@google/genai';
import type { AiRole } from '@teamchat/shared';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';

/**
 * The ONLY file that knows the AI provider (Google Gemini via @google/genai). Everything else
 * sees provider-neutral turns in and text pieces + token counts out, so switching providers
 * means rewriting this file only.
 */

/** Mutable so tests can use short timeouts. */
export const aiConfig = {
  /** Give up if the first piece of text hasn't arrived by then (the model may "think" first). */
  firstChunkTimeoutMs: 30_000,
  /** Give up if the stream goes silent this long between pieces. */
  idleTimeoutMs: 30_000,
};

export const SYSTEM_PROMPT = `You are the assistant built into TeamChat AI, a team chat app.
Help the signed-in user with whatever they ask: questions on any topic, explaining concepts,
drafting and editing messages or longer texts, summarising text they paste, and writing or
reviewing code. Answer the request as asked; don't turn down a task just because it isn't about
work. Be clear and practical, and use Markdown (lists, short headings, fenced code blocks with a
language) when it makes the answer easier to read. If you don't know something, say so instead
of guessing. You can't see the team's channels from here: if asked about them, say so briefly and
suggest typing "@ai" followed by the question in that channel, or using its Summarize button.`;

export interface AiTurn {
  role: AiRole;
  content: string;
}

/**
 * Token counts as Gemini reports them during the stream (each chunk repeats the running totals).
 * Passed in by the caller so the counts survive a stop or failure, when the stream never
 * reaches its final `usage` event.
 */
export interface TokenMeter {
  inputTokens: number;
  outputTokens: number;
  /** False if Gemini never sent counts (e.g. stopped before the first piece). */
  reported: boolean;
}

export const newTokenMeter = (): TokenMeter => ({
  inputTokens: 0,
  outputTokens: 0,
  reported: false,
});

export type AiStreamEvent =
  { type: 'text'; text: string } | { type: 'usage'; inputTokens: number; outputTokens: number };

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    // No SDK retries: the default is 5 attempts with up to 60 s between them, and in testing a
    // retried 503 hung until our timeout instead of failing. The user gets a fast "busy" error
    // and a Retry button instead.
    httpOptions: { retryOptions: { attempts: 1 } },
  });
  return client;
}

/** Gemini names the assistant's role 'model'. */
const toGeminiContents = (turns: AiTurn[]): Content[] =>
  turns.map((t) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: t.content }],
  }));

/** Thrown when OUR caller aborted (client disconnected / pressed stop), not a provider error. */
export class AiAbortedError extends Error {
  constructor() {
    super('AI stream aborted by the caller');
    this.name = 'AiAbortedError';
  }
}

function toAppError(err: unknown): AppError {
  if (err instanceof ApiError) {
    // 429 = our quota (free tier), 503 = the model is overloaded ("high demand"): both pass.
    if (err.status === 429 || err.status === 503) {
      return new AppError(
        err.status,
        'AI_BUSY',
        'The assistant is busy right now. Try again in a minute.',
      );
    }
    // Bad key / unknown model are configuration problems: say what to check, never the key.
    const hint =
      err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404
        ? 'check GEMINI_API_KEY and AI_MODEL'
        : undefined;
    logger.error(
      { status: err.status, providerMessage: err.message, hint },
      'gemini request failed',
    );
  } else {
    logger.error({ err }, 'gemini request failed');
  }
  return new AppError(502, 'AI_ERROR', 'The assistant could not answer. Try again.');
}

/**
 * Streams the assistant's reply to `turns` (oldest first, ending with the new question):
 * text pieces as they arrive, then one `usage` event. Aborting `signal` (or the caller breaking
 * out of the loop) cancels the HTTP request to Gemini.
 *
 * Throws AiAbortedError if `signal` aborted it, AppError 504 AI_TIMEOUT on a stall, and
 * AppError 429/503 (busy) or 502 for provider errors.
 */
export async function* streamReply(
  turns: AiTurn[],
  signal: AbortSignal,
  /** The panel's prompt by default; @ai and summaries pass their own. */
  systemPrompt: string = SYSTEM_PROMPT,
  meter: TokenMeter = newTokenMeter(),
): AsyncGenerator<AiStreamEvent> {
  // Our own controller: aborts on the caller's signal, on a timeout, or when we finish early.
  const inner = new AbortController();
  const onCallerAbort = () => inner.abort();
  signal.addEventListener('abort', onCallerAbort, { once: true });

  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const armTimer = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      inner.abort();
    }, ms);
  };

  // Rejects as soon as `inner` aborts, so a stalled network read can't keep us waiting even if
  // the SDK only notices the abort later.
  const aborted = new Promise<never>((_, reject) => {
    inner.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  aborted.catch(() => {}); // handled through the races below; avoid an unhandled rejection
  /** Race `p` against the abort. If the abort wins, `p` may still reject later: swallow that. */
  const raceAbort = <T>(p: Promise<T>): Promise<T> => {
    p.catch(() => {});
    return Promise.race([p, aborted]);
  };

  try {
    if (signal.aborted) throw new AiAbortedError();
    armTimer(aiConfig.firstChunkTimeoutMs);
    const stream = await raceAbort(
      getClient().models.generateContentStream({
        model: env.AI_MODEL as string,
        contents: toGeminiContents(turns),
        config: { systemInstruction: systemPrompt, abortSignal: inner.signal },
      }),
    );

    while (true) {
      const next = await raceAbort(stream.next());
      if (next.done) break;
      armTimer(aiConfig.idleTimeoutMs);
      const chunk = next.value;
      if (chunk.usageMetadata) {
        // Each chunk repeats the running totals; keep the latest. "Thinking" tokens are billed
        // as output too.
        meter.inputTokens = chunk.usageMetadata.promptTokenCount ?? meter.inputTokens;
        meter.outputTokens =
          (chunk.usageMetadata.candidatesTokenCount ?? 0) +
          (chunk.usageMetadata.thoughtsTokenCount ?? 0);
        meter.reported = true;
      }
      const text = chunk.text;
      if (text) yield { type: 'text', text };
    }
    yield { type: 'usage', inputTokens: meter.inputTokens, outputTokens: meter.outputTokens };
  } catch (err) {
    if (signal.aborted) throw new AiAbortedError();
    if (timedOut) {
      throw new AppError(504, 'AI_TIMEOUT', 'The assistant took too long to answer. Try again.');
    }
    if (err instanceof AppError || err instanceof AiAbortedError) throw err;
    throw toAppError(err);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onCallerAbort);
    // Finished, failed, or the caller stopped iterating: make sure the request is closed.
    inner.abort();
  }
}
