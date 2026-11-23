import type { ClientToServerEvents, ServerToClientEvents } from '@teamchat/shared';
import type { Server, Socket } from 'socket.io';

/** Set by the handshake middleware; lives as long as the connection. */
export interface SocketData {
  userId: string;
  /** Workspaces the user belonged to when they connected (their presence rooms). */
  workspaceIds: string[];
}

// No server-to-server events yet (they arrive with the Redis adapter on Day 5).
type InterServerEvents = Record<string, never>;

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
export type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export const channelRoom = (channelId: string) => `channel:${channelId}`;
export const workspaceRoom = (workspaceId: string) => `workspace:${workspaceId}`;
/** Every socket of one user (all their tabs): a private mailbox for user-targeted events. */
export const userRoom = (userId: string) => `user:${userId}`;
