import { SOCKET_EVENTS } from '@teamchat/shared';
import { queryClient } from '../../lib/queryClient';
import { socket } from '../../lib/socket';
import { usePendingStore } from '../../stores/pending';
import { applyAiChunk, applyAiFailed } from './aiReplies';
import { insertMessage, replaceMessage, setReactions } from './messageCache';
import { queryKeys } from './queries';
import { confirmMessage, flushQueue } from './send';
import { applyRead, bumpUnread, unreadKey } from './unread';

let started = false;

/**
 * App-wide socket → cache wiring (once per page load):
 * - message:new → into that channel's cached history; if it carries one of OUR tempIds, it
 *   confirms the optimistic row (it may beat the ack, or arrive after an ack timed out)
 * - message:updated / message:deleted / reaction:updated → patch the cached message by id
 * - ai:chunk → append to the bot message (by offset); ai:failed → drop it, show the asker a retry
 * - channel:activity → unread +1 for channels whose room we're not in; channel:read → clear
 * - workspace:added → refetch the workspace list (onboarding / switcher update by themselves)
 * - every (re)connect → send messages queued while offline, refetch unread counts
 */
export function startRealtimeSync(): void {
  if (started) return;
  started = true;

  socket.on(SOCKET_EVENTS.messageNew, ({ message, tempId }) => {
    if (usePendingStore.getState().byTempId[tempId]) confirmMessage(message, tempId);
    else insertMessage(message);
  });
  socket.on(SOCKET_EVENTS.messageUpdated, ({ message }) => replaceMessage(message));
  socket.on(SOCKET_EVENTS.messageDeleted, ({ message }) => replaceMessage(message));
  socket.on(SOCKET_EVENTS.reactionUpdated, ({ channelId, messageId, reactions }) =>
    setReactions(channelId, messageId, reactions),
  );

  // @ai answers stream into the bot message; a failure removes it (and tells the asker).
  socket.on(SOCKET_EVENTS.aiChunk, applyAiChunk);
  socket.on(SOCKET_EVENTS.aiFailed, applyAiFailed);

  socket.on(SOCKET_EVENTS.channelActivity, bumpUnread);
  socket.on(SOCKET_EVENTS.channelRead, ({ channelId, lastReadMessageId }) =>
    applyRead(channelId, lastReadMessageId),
  );

  socket.on(SOCKET_EVENTS.workspaceAdded, () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
    void queryClient.invalidateQueries({ queryKey: unreadKey });
  });

  socket.on('connect', () => {
    flushQueue();
    // Activity while we were offline never reached us: recount.
    void queryClient.invalidateQueries({ queryKey: unreadKey });
  });
}
