import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * One shared Redis connection (Step 4.4 usage counters; Day 5 adds caching, the Socket.IO
 * adapter and pub/sub). Created on first use, so tests and scripts that never touch Redis don't
 * connect.
 *
 * Fail fast instead of waiting: with `enableOfflineQueue: false` a command sent while Redis is
 * down errors immediately (callers decide what to do: the usage limit fails open), instead of
 * queueing until Redis comes back. ioredis keeps reconnecting in the background.
 */
let client: Redis | undefined;
let lastErrorLog = 0;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
    });
    // Without a listener, ioredis errors would crash the process. While Redis is down it emits
    // one per reconnect attempt: log at most one a minute.
    client.on('error', (err) => {
      if (Date.now() - lastErrorLog < 60_000) return;
      lastErrorLog = Date.now();
      logger.warn({ err: err.message }, 'Redis unavailable (retrying in the background)');
    });
  }
  return client;
}

/**
 * Called at startup: open the connection before the first request (with the offline queue
 * off, commands sent while it's still connecting would fail). If Redis isn't there, log and
 * carry on: the usage limit fails open and ioredis keeps retrying in the background.
 */
export async function connectRedis(timeoutMs = 3_000): Promise<boolean> {
  const redis = getRedis();
  if (redis.status === 'ready') return true;
  const ready = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    redis.once('ready', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  const ok = await ready;
  if (ok) logger.info('Connected to Redis');
  else
    logger.warn(
      `Redis not reachable at startup (${env.REDIS_URL.replace(/\/\/.*@/, '//***@')}); AI usage limit not enforced until it is`,
    );
  return ok;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  await client.quit().catch(() => client?.disconnect());
  client = undefined;
}
