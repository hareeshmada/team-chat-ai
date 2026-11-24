import { ApiError, authedFetch, toApiError } from './api';

export interface StreamTextOptions {
  body: unknown;
  signal: AbortSignal;
  /** Each decoded piece of text, in order. */
  onChunk: (text: string) => void;
  /** Called once with the response headers, before the first chunk. */
  onOpen?: (headers: Headers) => void;
}

/** The stream broke after some text arrived (server cut it, network dropped). */
export class StreamCutError extends Error {
  constructor() {
    super('The answer was cut off.');
    this.name = 'StreamCutError';
  }
}

/**
 * POSTs JSON and reads a chunked text/plain response piece by piece (fetch + ReadableStream).
 *
 * - Errors before any text (4xx/5xx JSON, an expired token that can't be refreshed) throw the
 *   usual ApiError. The token refresh + resend happens before the body is read, so a question
 *   is never sent twice.
 * - Aborting `signal` (Stop) rejects with an AbortError.
 * - A connection that breaks mid-answer throws StreamCutError.
 *
 * TextDecoder with `stream: true` keeps a multi-byte character (é, emoji) that is split across
 * two network chunks from turning into "�".
 */
export async function streamText(path: string, options: StreamTextOptions): Promise<void> {
  const res = await authedFetch(path, {
    method: 'POST',
    body: options.body,
    signal: options.signal,
  });
  if (!res.ok) throw await toApiError(res);
  if (!res.body) throw new ApiError(0, 'NETWORK_ERROR', 'Streaming is not supported here.');
  options.onOpen?.(res.headers);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) options.onChunk(text);
    }
    const rest = decoder.decode(); // flush a trailing partial character, if any
    if (rest) options.onChunk(rest);
  } catch (err) {
    if (options.signal.aborted) throw err; // Stop: let the AbortError through
    throw new StreamCutError();
  } finally {
    reader.releaseLock();
  }
}
