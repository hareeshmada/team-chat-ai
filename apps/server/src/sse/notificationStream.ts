import { SSE_EVENTS, type PublicNotification } from '@teamchat/shared';
import type { Request, Response } from 'express';
import { subscribeNotifications, type StreamEvent } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import { listSince } from '../services/notification.service.js';

/** Mutable so tests can use a short heartbeat. */
export const sseConfig = {
  /** A comment line this often keeps proxies/load balancers from closing an idle stream. */
  heartbeatMs: 25_000,
  /** Browser reconnect delay hint (EventSource's `retry:` field). */
  retryMs: 3_000,
  /** Open streams per user (tabs); one more gets 429. */
  maxStreamsPerUser: 5,
};

/** Every open stream, so shutdown can end them (they would keep server.close() waiting). */
const open = new Set<Response>();
const perUser = new Map<string, number>();

export const openStreamCount = (userId: string) => perUser.get(userId) ?? 0;

/** On shutdown: end every stream; browsers reconnect (with Last-Event-ID) to another server. */
export function closeAllStreams(): void {
  for (const res of open) res.end();
  open.clear();
}

/** One SSE frame. `data` is single-line JSON, so one `data:` line is enough. */
function frame(n: PublicNotification): string {
  return `id: ${n.id}\nevent: ${SSE_EVENTS.notification}\ndata: ${JSON.stringify(n)}\n\n`;
}

/**
 * Read-state changes have NO id: they aren't replayed (a reconnecting client reloads the list
 * anyway), and a frame without `id:` leaves the browser's last event id unchanged.
 */
function readFrame(event: Extract<StreamEvent, { event: 'read' }>): string {
  return `event: ${SSE_EVENTS.read}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/**
 * Runs an authenticated notification stream for `userId` until the client disconnects.
 *
 * Replay without gaps or duplicates: subscribe to the bus FIRST (buffering live events), then
 * query what was missed since `lastEventId`, send it, then flush the buffer skipping ids that
 * the replay already sent. Subscribing after the query would lose anything created in between.
 */
export async function runNotificationStream(
  req: Request,
  res: Response,
  userId: string,
  lastEventId: string | undefined,
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform: proxies must not compress/buffer the stream.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx buffers proxied responses by default; this turns it off for this response (Day 7).
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`retry: ${sseConfig.retryMs}\n\n`);

  open.add(res);
  perUser.set(userId, openStreamCount(userId) + 1);

  let closed = false;
  let buffer: PublicNotification[] | null = []; // non-null while the replay is running
  const sent = new Set<string>();
  const write = (n: PublicNotification) => {
    if (closed || sent.has(n.id)) return;
    sent.add(n.id);
    res.write(frame(n));
  };

  const unsubscribe = subscribeNotifications(userId, (e) => {
    if (closed) return;
    if (e.event === 'read') res.write(readFrame(e));
    else if (buffer) buffer.push(e.data);
    else res.write(frame(e.data));
  });
  const heartbeat = setInterval(() => {
    if (!closed) res.write(': ping\n\n');
  }, sseConfig.heartbeatMs);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    open.delete(res);
    const left = openStreamCount(userId) - 1;
    if (left > 0) perUser.set(userId, left);
    else perUser.delete(userId);
  };
  // 'close' fires when the client goes away (tab closed, network lost) or we end the response.
  res.on('close', cleanup);
  req.on('close', cleanup);

  try {
    if (lastEventId) for (const n of await listSince(userId, lastEventId)) write(n);
  } catch (err) {
    logger.error({ err }, 'notification replay failed');
  }
  const pending = buffer;
  buffer = null;
  pending.forEach(write);
  sent.clear(); // only needed to de-duplicate the replay window
}
