import { setTimeout as sleep } from 'node:timers/promises';
import mongoose from 'mongoose';
import { logger } from './logger.js';

export interface ConnectDbOptions {
  /** Total attempts, including the first one. */
  retries?: number;
  /** Delay before the 2nd attempt; doubles each time (1s, 2s, 4s, …). */
  baseDelayMs?: number;
}

// Errors that can go away on their own (network blip, DNS hiccup, cluster still starting).
const TRANSIENT_ERROR_NAMES = new Set([
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
]);
const TRANSIENT_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
]);

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (TRANSIENT_ERROR_NAMES.has(err.name)) return true;
  const { code } = err as NodeJS.ErrnoException;
  return typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code);
}

export async function connectDb(
  uri: string,
  dbName: string,
  { retries = 5, baseDelayMs = 1000 }: ConnectDbOptions = {},
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
      break;
    } catch (err) {
      // Bad URI or bad password: retrying can't fix it, so fail fast.
      if (!isTransient(err)) throw err;

      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= retries) {
        throw new Error(`Could not connect to MongoDB after ${retries} attempts: ${message}`, {
          cause: err,
        });
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(
        `MongoDB connect attempt ${attempt}/${retries} failed: ${message}, retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  // Never log the URI itself: it contains credentials.
  const { host, name } = mongoose.connection;
  logger.info(`MongoDB connected (host ${host}, db ${name})`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
