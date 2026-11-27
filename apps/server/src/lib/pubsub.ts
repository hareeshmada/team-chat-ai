import { getRedis } from './redis.js';
import { logger } from './logger.js';

/**
 * Worker → API events over Redis pub/sub (Step 5.2). The worker has no Socket.IO server, so
 * when a job changes something the browser should see, it publishes a small event here and each
 * API instance relays it to its sockets. Events carry ids only; the API reloads the data.
 */

const CHANNEL = 'teamchat:events';

export type ServerEvent = { type: 'invite:updated'; inviteId: string };

/** Fire and forget: a lost event only means the UI updates on its next refetch. */
export async function publishEvent(event: ServerEvent): Promise<void> {
  try {
    await getRedis().publish(CHANNEL, JSON.stringify(event));
  } catch (err) {
    logger.warn({ err: (err as Error).message, type: event.type }, 'event publish failed');
  }
}

/**
 * Subscribes on a second connection (a subscribed Redis connection can't run other commands).
 * Unlike the shared client it queues commands while connecting, and ioredis re-subscribes by
 * itself after a reconnect. Returns a function that closes the connection.
 */
export function subscribeEvents(handler: (event: ServerEvent) => void): () => Promise<void> {
  const sub = getRedis().duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null });
  sub.on('error', () => {}); // the shared client already logs Redis being down
  sub
    .subscribe(CHANNEL)
    .catch((err: Error) => logger.warn({ err: err.message }, 'subscribe failed'));
  sub.on('message', (_channel: string, raw: string) => {
    try {
      handler(JSON.parse(raw) as ServerEvent);
    } catch (err) {
      logger.error({ err }, 'event handler failed');
    }
  });
  return async () => {
    await sub.quit().catch(() => sub.disconnect());
  };
}
