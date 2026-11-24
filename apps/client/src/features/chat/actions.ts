import { SOCKET_EVENTS, type PublicMessage, type ReactionEmoji } from '@teamchat/shared';
import { socket } from '../../lib/socket';
import { useAuthStore } from '../../stores/auth';
import { getCachedMessage, replaceMessage, setReactions } from './messageCache';
import { ACK_TIMEOUT_MS } from './send';

/** Thrown with a message that can be shown next to the message row. */
export class ActionError extends Error {}

function ensureOnline() {
  if (!socket.connected) throw new ActionError('You’re offline. Try again when reconnected.');
}

/** Author only (the server checks too). Resolves once the server saved it. */
export async function editMessage(message: PublicMessage, body: string): Promise<void> {
  ensureOnline();
  const res = await socket
    .timeout(ACK_TIMEOUT_MS)
    .emitWithAck(SOCKET_EVENTS.messageEdit, { messageId: message.id, body })
    .catch(() => {
      throw new ActionError('No response from the server');
    });
  if (!res.ok) throw new ActionError(res.error.message);
  replaceMessage(res.message); // message:updated brings the same; this is just sooner
}

/** Soft delete. Author only. */
export async function deleteMessage(message: PublicMessage): Promise<void> {
  ensureOnline();
  const res = await socket
    .timeout(ACK_TIMEOUT_MS)
    .emitWithAck(SOCKET_EVENTS.messageDelete, { messageId: message.id })
    .catch(() => {
      throw new ActionError('No response from the server');
    });
  if (!res.ok) throw new ActionError(res.error.message);
  replaceMessage(res.message);
}

/**
 * Optimistic: the pill changes at once; the ack's reactions (the server's truth) replace it,
 * and a failure puts the previous reactions back.
 */
export async function toggleReaction(message: PublicMessage, emoji: ReactionEmoji): Promise<void> {
  ensureOnline();
  const me = useAuthStore.getState().user?.id;
  if (!me) return;
  const before = getCachedMessage(message.channelId, message.id)?.reactions ?? message.reactions;

  const has = before.some((r) => r.emoji === emoji && r.userIds.includes(me));
  const next = has
    ? before
        .map((r) => (r.emoji === emoji ? { ...r, userIds: r.userIds.filter((u) => u !== me) } : r))
        .filter((r) => r.userIds.length > 0)
    : before.some((r) => r.emoji === emoji)
      ? before.map((r) => (r.emoji === emoji ? { ...r, userIds: [...r.userIds, me] } : r))
      : [...before, { emoji, userIds: [me] }];
  setReactions(message.channelId, message.id, next);

  try {
    const res = await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(SOCKET_EVENTS.reactionToggle, { messageId: message.id, emoji });
    if (!res.ok) throw new ActionError(res.error.message);
    setReactions(message.channelId, message.id, res.reactions);
  } catch (err) {
    setReactions(message.channelId, message.id, before);
    throw err instanceof ActionError ? err : new ActionError('No response from the server');
  }
}
