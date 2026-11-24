import { EventEmitter } from 'node:events';
import type { NotificationsReadEvent, PublicNotification } from '@teamchat/shared';

/**
 * The in-process event bus for a user's notification stream. ONE module owns it, so Day 5 can
 * swap the body for Redis pub/sub (publish → PUBLISH, subscribe → SUBSCRIBE) without touching the
 * callers. Today it only reaches streams on THIS server instance.
 */
export type StreamEvent =
  | { event: 'notification'; data: PublicNotification }
  | { event: 'read'; data: NotificationsReadEvent };

const emitter = new EventEmitter();
// One listener per open stream: a user with many tabs is normal, not a leak.
emitter.setMaxListeners(0);

const channel = (userId: string) => `stream:${userId}`;

export function publishNotification(userId: string, notification: PublicNotification): void {
  emitter.emit(channel(userId), {
    event: 'notification',
    data: notification,
  } satisfies StreamEvent);
}

/** Some notifications were marked read: every open stream (tab) of this user updates its bell. */
export function publishRead(userId: string, data: NotificationsReadEvent): void {
  emitter.emit(channel(userId), { event: 'read', data } satisfies StreamEvent);
}

/** Returns the unsubscribe function (call it when the stream closes). */
export function subscribeNotifications(
  userId: string,
  listener: (event: StreamEvent) => void,
): () => void {
  emitter.on(channel(userId), listener);
  return () => emitter.off(channel(userId), listener);
}

/** For tests and diagnostics: open subscriptions for a user. */
export function notificationListenerCount(userId: string): number {
  return emitter.listenerCount(channel(userId));
}
