import { presenceListSchema, SOCKET_EVENTS } from '@teamchat/shared';
import {
  forbidden,
  isWorkspaceMember,
  listWorkspaceMemberIds,
} from '../../services/access.service.js';
import { handle } from '../handle.js';
import type { PresenceStore } from '../presence.js';
import { userRoom, workspaceRoom, type IoServer, type IoSocket } from '../types.js';

/**
 * On connect: join one room per workspace and, if this is the user's first socket, tell those
 * workspaces they're online. On disconnect: if it was the last socket, tell them they're offline.
 * presence:list gives a fresh page the starting state (presence:update only sends changes).
 */
export function registerPresenceHandlers(io: IoServer, socket: IoSocket, presence: PresenceStore) {
  const { userId, workspaceIds } = socket.data;
  const rooms = [userRoom(userId), ...workspaceIds.map(workspaceRoom)];

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

  // 'disconnecting' still has socket.rooms; read the workspace rooms from there (not the
  // connect-time list), because an invite may have added one while the socket was open.
  socket.on('disconnecting', () => {
    if (!presence.remove(userId)) return;
    const workspaceIdsNow = [...socket.rooms]
      .filter((room) => room.startsWith('workspace:'))
      .map((room) => room.slice('workspace:'.length));
    for (const workspaceId of workspaceIdsNow) {
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
      // Membership checked: make sure this socket gets the workspace's presence updates, even if
      // it joined the workspace after connecting (created it, or was invited, while online).
      await socket.join(workspaceRoom(workspaceId));
      const memberIds = await listWorkspaceMemberIds(workspaceId);
      return { userIds: memberIds.filter((id) => presence.isOnline(id)) };
    }),
  );
}
