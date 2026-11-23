import { SOCKET_EVENTS, type PublicMessage } from '@teamchat/shared';
import { socket } from '../../lib/socket';
import { useAuthStore } from '../../stores/auth';
import { usePendingStore, type PendingMessage } from '../../stores/pending';
import { insertMessage } from './messageCache';

/** No ack within this time → the message is marked failed (it keeps its text for retry). */
export const ACK_TIMEOUT_MS = 10_000;

const pending = usePendingStore.getState;

/** The saved message is in: show it from the cache and drop the optimistic copy. */
export function confirmMessage(message: PublicMessage, tempId: string): void {
  insertMessage(message);
  pending().remove(tempId);
}

function emit(message: PendingMessage): void {
  // Offline: keep it "sending…" in the queue; flushQueue() sends it on reconnect. The 10 s
  // timer only starts once the message is really on its way.
  if (!socket.connected) return;
  pending().update(message.tempId, { status: 'sending', error: undefined });

  socket
    .timeout(ACK_TIMEOUT_MS)
    .emit(
      SOCKET_EVENTS.messageSend,
      { channelId: message.channelId, body: message.body, tempId: message.tempId },
      (err, res) => {
        if (!pending().byTempId[message.tempId]) return; // already confirmed by message:new
        if (err) {
          pending().update(message.tempId, {
            status: 'failed',
            error: 'No response from the server',
          });
        } else if (!res.ok) {
          pending().update(message.tempId, { status: 'failed', error: res.error.message });
        } else {
          confirmMessage(res.message, message.tempId);
        }
      },
    );
}

/** Optimistic send: the row appears at once; the ack (or message:new) replaces it. */
export function sendMessage(channelId: string, body: string): void {
  const message: PendingMessage = {
    tempId: crypto.randomUUID(),
    channelId,
    authorId: useAuthStore.getState().user?.id ?? '',
    body,
    status: 'queued',
    createdAt: new Date().toISOString(),
  };
  pending().add(message);
  emit(message);
}

export function retryMessage(tempId: string): void {
  const message = pending().byTempId[tempId];
  if (!message) return;
  pending().update(tempId, { status: 'queued', error: undefined });
  emit({ ...message, status: 'queued' });
}

export function discardMessage(tempId: string): void {
  pending().remove(tempId);
}

/** On (re)connect: send everything this user typed while offline (or before a reload), oldest first. */
export function flushQueue(): void {
  const me = useAuthStore.getState().user?.id;
  Object.values(pending().byTempId)
    .filter((m) => m.status === 'queued' && m.authorId === me)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach(emit);
}
