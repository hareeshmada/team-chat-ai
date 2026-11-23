import type { Ack, SocketError } from '@teamchat/shared';
import { z } from 'zod';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';

function toSocketError(err: unknown): SocketError {
  if (err instanceof z.ZodError) {
    return { code: 'VALIDATION_ERROR', message: z.prettifyError(err) };
  }
  if (err instanceof AppError) return { code: err.code, message: err.message };
  logger.error({ err }, 'Socket handler failed');
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong' };
}

/**
 * Wraps a client → server event handler: validates the payload with Zod, runs the handler and
 * answers through the ack callback with { ok: true, ...result } or { ok: false, error }.
 * Any error becomes an ack error, so a bad event can never crash the process. A client that
 * sent no callback (or something that isn't a function) just gets no answer.
 */
export function handle<S extends z.ZodType, R extends object>(
  schema: S,
  handler: (input: z.output<S>) => Promise<R> | R,
) {
  return async (payload: unknown, ack?: unknown): Promise<void> => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack<R>) => void) : () => {};
    try {
      const result = await handler(schema.parse(payload));
      reply({ ok: true, ...result });
    } catch (err) {
      reply({ ok: false, error: toSocketError(err) });
    }
  };
}
