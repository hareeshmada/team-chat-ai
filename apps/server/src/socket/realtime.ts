import { SOCKET_EVENTS, type PublicMessage, type PublicWorkspace } from '@teamchat/shared';
import type { ChannelDocument } from '../models/Channel.js';
import type { PresenceStore } from './presence.js';
import { userRoom, workspaceRoom, type IoServer } from './types.js';

/**
 * The bridge from HTTP code to sockets. Controllers call these after a successful write, so
 * services stay free of Socket.IO. Before createSocketServer() runs (e.g. Supertest-only
 * tests) there is no io, and every function is a no-op.
 */
let current: { io: IoServer; presence: PresenceStore } | null = null;

/** Called by createSocketServer (the last created server wins, which is what tests need). */
export function setRealtime(io: IoServer, presence: PresenceStore): void {
  current = { io, presence };
}

/**
 * Someone was added to a workspace: tell their open tabs (so onboarding / the switcher update
 * without a reload), put those sockets in the workspace's presence room, and, if they're online,
 * tell the workspace they are.
 */
export function notifyMemberAdded(workspace: PublicWorkspace, userId: string): void {
  if (!current) return;
  const { io, presence } = current;

  // Every socket in the user's room joins the workspace room (works across instances with an adapter).
  io.in(userRoom(userId)).socketsJoin(workspaceRoom(workspace.id));

  io.to(userRoom(userId)).emit(SOCKET_EVENTS.workspaceAdded, { workspace });
  if (presence.isOnline(userId)) {
    io.to(workspaceRoom(workspace.id)).emit(SOCKET_EVENTS.presenceUpdate, {
      workspaceId: workspace.id,
      userId,
      online: true,
    });
  }
}

/** Sockets that may see this channel: its workspace room if public, its members if private. */
function channelAudience(io: IoServer, channel: ChannelDocument) {
  return channel.isPrivate
    ? io.to(channel.memberIds.map((id) => userRoom(id.toString())))
    : io.to(workspaceRoom(channel.workspaceId.toString()));
}

/**
 * A message was posted: tell everyone who can see the channel, even if they haven't joined its
 * room, so their sidebar can bump the unread count (and the "@n" badge if they're mentioned).
 * Private channels go to each member's user room, so outsiders never learn the channel exists.
 */
export function notifyChannelActivity(channel: ChannelDocument, message: PublicMessage): void {
  if (!current) return;
  channelAudience(current.io, channel).emit(SOCKET_EVENTS.channelActivity, {
    workspaceId: channel.workspaceId.toString(),
    channelId: message.channelId,
    messageId: message.id,
    authorId: message.authorId,
    mentionedUserIds: message.mentionedUserIds,
  });
}

/** One tab marked a channel read: the user's other tabs clear the badge too. */
export function notifyChannelRead(userId: string, channelId: string, lastReadMessageId: string) {
  if (!current) return;
  current.io.to(userRoom(userId)).emit(SOCKET_EVENTS.channelRead, { channelId, lastReadMessageId });
}
