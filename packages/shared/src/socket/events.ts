import { z } from 'zod';
import { objectIdSchema } from '../schemas/common.js';
import type { PublicMessage } from '../schemas/message.js';
import type { PublicWorkspace } from '../schemas/workspace.js';

/**
 * The Socket.IO contract shared by client and server: event names, payload schemas
 * (the server validates every incoming payload with these) and typed event maps
 * for `new Server<ClientToServerEvents, ServerToClientEvents>()` / `io<...>()`.
 */
export const SOCKET_EVENTS = {
  // client → server
  channelJoin: 'channel:join',
  channelLeave: 'channel:leave',
  messageSend: 'message:send',
  typingStart: 'typing:start',
  typingStop: 'typing:stop',
  presenceList: 'presence:list',
  latencyPing: 'latency:ping',
  // server → client
  messageNew: 'message:new',
  typingUpdate: 'typing:update',
  presenceUpdate: 'presence:update',
  workspaceAdded: 'workspace:added',
} as const;

export const MESSAGE_BODY_MAX = 4000;

// ---- payload schemas (client → server) ------------------------------------------------------

export const channelRefSchema = z.object({ channelId: objectIdSchema });

export const sendMessageSchema = z.object({
  channelId: objectIdSchema,
  body: z.string().trim().min(1, 'Message is empty').max(MESSAGE_BODY_MAX),
  /** Client-generated id so the sender can match the ack / broadcast to its optimistic row. */
  tempId: z.string().min(1).max(64),
});

export const presenceListSchema = z.object({ workspaceId: objectIdSchema });

export type ChannelRef = z.infer<typeof channelRefSchema>;
export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type PresenceListInput = z.infer<typeof presenceListSchema>;

// ---- acknowledgements -----------------------------------------------------------------------

export interface SocketError {
  code: string;
  message: string;
}

/** Every client → server event answers through its ack callback with one of these. */
export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: SocketError };
export type AckCallback<T = object> = (response: Ack<T>) => void;

// ---- server → client payloads ---------------------------------------------------------------

export interface MessageNewPayload {
  message: PublicMessage;
  /** The sender's tempId (lets the sender's other tabs/optimistic row de-duplicate). */
  tempId: string;
}

export interface TypingUpdatePayload {
  channelId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceUpdatePayload {
  workspaceId: string;
  userId: string;
  online: boolean;
}

/** Sent to a user's own sockets when someone adds them to a workspace. */
export interface WorkspaceAddedPayload {
  workspace: PublicWorkspace;
}

// ---- typed event maps -----------------------------------------------------------------------

export interface ClientToServerEvents {
  'channel:join': (payload: ChannelRef, ack: AckCallback) => void;
  'channel:leave': (payload: ChannelRef, ack: AckCallback) => void;
  'message:send': (payload: SendMessageInput, ack: AckCallback<{ message: PublicMessage }>) => void;
  'typing:start': (payload: ChannelRef) => void;
  'typing:stop': (payload: ChannelRef) => void;
  'presence:list': (payload: PresenceListInput, ack: AckCallback<{ userIds: string[] }>) => void;
  /** Round-trip time for the status bar: the client times how long the ack takes. */
  'latency:ping': (ack: AckCallback) => void;
}

export interface ServerToClientEvents {
  'message:new': (payload: MessageNewPayload) => void;
  'typing:update': (payload: TypingUpdatePayload) => void;
  'presence:update': (payload: PresenceUpdatePayload) => void;
  'workspace:added': (payload: WorkspaceAddedPayload) => void;
}
