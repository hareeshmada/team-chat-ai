import { presenceListSchema, SOCKET_EVENTS } from '@teamchat/shared';
import {
  forbidden,
  isWorkspaceMember,
  listWorkspaceMemberIds,
} from '../../services/access.service.js';
import { handle } from '../handle.js';
import type { PresenceStore } from '../presence.js';
import { workspaceRoom, type IoServer, type IoSocket } from '../types.js';

/**
 * On connect: join one room per workspace and, if this is the user's first socket, tell those
 * workspaces they're online. On disconnect: if it was the last socket, tell them they're offline.
 * presence:list gives a fresh page the starting state (presence:update only sends changes).
 */
export function registerPresenceHandlers(io: IoServer, socket: IoSocket, presence: PresenceStore) {
  const { userId, workspaceIds } = socket.data;
  const rooms = workspaceIds.map(workspaceRoom);

  void socket.join(rooms);
  if (presence.add(userId)) {
    for (const workspaceId of workspaceIds) {
      io.to(workspaceRoom(workspaceId)).emit(SOCKET_EVENTS.presenceUpdate, {
        workspaceId,
        userId,
        online: true,
      });
    }
  }

  socket.on('disconnect', () => {
    if (!presence.remove(userId)) return;
    for (const workspaceId of workspaceIds) {
      io.to(workspaceRoom(workspaceId)).emit(SOCKET_EVENTS.presenceUpdate, {
        workspaceId,
        userId,
        online: false,
      });
    }
  });

  socket.on(
    SOCKET_EVENTS.presenceList,
    handle(presenceListSchema, async ({ workspaceId }) => {
      if (!(await isWorkspaceMember(userId, workspaceId))) throw forbidden();
      const memberIds = await listWorkspaceMemberIds(workspaceId);
      return { userIds: memberIds.filter((id) => presence.isOnline(id)) };
    }),
  );
}
