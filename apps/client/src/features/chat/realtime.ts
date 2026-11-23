import { SOCKET_EVENTS } from '@teamchat/shared';
import { queryClient } from '../../lib/queryClient';
import { socket } from '../../lib/socket';
import { usePendingStore } from '../../stores/pending';
import { insertMessage } from './messageCache';
import { queryKeys } from './queries';
import { confirmMessage, flushQueue } from './send';

let started = false;

/**
 * App-wide socket → cache wiring (once per page load):
 * - message:new → into that channel's cached history; if it carries one of OUR tempIds, it
 *   confirms the optimistic row (it may beat the ack, or arrive after an ack timed out)
 * - workspace:added → refetch the workspace list (onboarding / switcher update by themselves)
 * - every (re)connect → send messages queued while offline
 */
export function startRealtimeSync(): void {
  if (started) return;
  started = true;

  socket.on(SOCKET_EVENTS.messageNew, ({ message, tempId }) => {
    if (usePendingStore.getState().byTempId[tempId]) confirmMessage(message, tempId);
    else insertMessage(message);
  });

  socket.on(SOCKET_EVENTS.workspaceAdded, () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  });

  socket.on('connect', flushQueue);
}
