import { channelRefSchema, SOCKET_EVENTS } from '@teamchat/shared';
import { channelRoom, type IoSocket } from '../types.js';

/** At most one typing:start per channel per socket in this window; clients also throttle. */
export const TYPING_THROTTLE_MS = 2_000;

/**
 * Typing is fire-and-forget (no ack, no DB): it fires on keystrokes, so it must be cheap.
 * Only sockets that joined the channel room (access already checked) can broadcast to it.
 * Invalid payloads are dropped silently.
 */
export function registerTypingHandlers(socket: IoSocket) {
  const lastStart = new Map<string, number>(); // channelId → time of last forwarded start

  function broadcast(channelId: string, isTyping: boolean) {
    // socket.to = the room except this socket (you don't need to see your own indicator).
    socket
      .to(channelRoom(channelId))
      .emit(SOCKET_EVENTS.typingUpdate, { channelId, userId: socket.data.userId, isTyping });
  }

  socket.on(SOCKET_EVENTS.typingStart, (payload: unknown) => {
    const parsed = channelRefSchema.safeParse(payload);
    if (!parsed.success) return;
    const { channelId } = parsed.data;
    if (!socket.rooms.has(channelRoom(channelId))) return;

    const now = Date.now();
    if (now - (lastStart.get(channelId) ?? 0) < TYPING_THROTTLE_MS) return;
    lastStart.set(channelId, now);
    broadcast(channelId, true);
  });

  socket.on(SOCKET_EVENTS.typingStop, (payload: unknown) => {
    const parsed = channelRefSchema.safeParse(payload);
    if (!parsed.success) return;
    const { channelId } = parsed.data;
    if (!lastStart.delete(channelId)) return; // wasn't typing here
    if (socket.rooms.has(channelRoom(channelId))) broadcast(channelId, false);
  });

  // Closing the tab mid-sentence shouldn't leave "X is typing…" stuck for everyone else.
  // 'disconnecting' still has socket.rooms filled ('disconnect' doesn't).
  socket.on('disconnecting', () => {
    for (const channelId of lastStart.keys()) {
      if (socket.rooms.has(channelRoom(channelId))) broadcast(channelId, false);
    }
  });
}
