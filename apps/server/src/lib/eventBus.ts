import { EventEmitter } from 'node:events';
import type { PublicNotification } from '@teamchat/shared';

/**
 * The in-process event bus for notifications. ONE module owns it, so Day 5 can swap the body
 * for Redis pub/sub (publish → PUBLISH, subscribe → SUBSCRIBE) without touching the callers.
 * Today it only reaches streams on THIS server instance.
 */
const emitter = new EventEmitter();
// One listener per open stream: a user with many tabs is normal, not a leak.
emitter.setMaxListeners(0);

const channel = (userId: string) => `notification:${userId}`;

export function publishNotification(userId: string, notification: PublicNotification): void {
  emitter.emit(channel(userId), notification);
}

/** Returns the unsubscribe function (call it when the stream closes). */
export function subscribeNotifications(
  userId: string,
  listener: (notification: PublicNotification) => void,
): () => void {
  emitter.on(channel(userId), listener);
  return () => emitter.off(channel(userId), listener);
}

/** For tests and diagnostics: open subscriptions for a user. */
export function notificationListenerCount(userId: string): number {
  return emitter.listenerCount(channel(userId));
}
