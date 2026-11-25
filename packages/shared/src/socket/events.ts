import { z } from 'zod';
import { objectIdSchema } from '../schemas/common.js';
import { reactionEmojiSchema, type PublicMessage, type Reaction } from '../schemas/message.js';
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
  messageEdit: 'message:edit',
  messageDelete: 'message:delete',
  reactionToggle: 'reaction:toggle',
  aiRetry: 'ai:retry',
  // server → client
  messageNew: 'message:new',
  typingUpdate: 'typing:update',
  presenceUpdate: 'presence:update',
  workspaceAdded: 'workspace:added',
  messageUpdated: 'message:updated',
  messageDeleted: 'message:deleted',
  reactionUpdated: 'reaction:updated',
  channelActivity: 'channel:activity',
  channelRead: 'channel:read',
  aiChunk: 'ai:chunk',
  aiFailed: 'ai:failed',
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

export const messageRefSchema = z.object({ messageId: objectIdSchema });

export const editMessageSchema = z.object({
  messageId: objectIdSchema,
  body: z.string().trim().min(1, 'Message is empty').max(MESSAGE_BODY_MAX),
});

export const toggleReactionSchema = z.object({
  messageId: objectIdSchema,
  emoji: reactionEmojiSchema,
});

/** Ask the AI again for one of your own `@ai` messages (after a failure). */
export const aiRetrySchema = z.object({ questionId: objectIdSchema });

export type ChannelRef = z.infer<typeof channelRefSchema>;
export type AiRetryInput = z.infer<typeof aiRetrySchema>;
export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type PresenceListInput = z.infer<typeof presenceListSchema>;
export type MessageRef = z.infer<typeof messageRefSchema>;
export type EditMessageInput = z.input<typeof editMessageSchema>;
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;

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

export interface MessageUpdatedPayload {
  message: PublicMessage;
}

export interface MessageDeletedPayload {
  /** The soft-deleted message (body, reactions and mentions already cleared). */
  message: PublicMessage;
}

export interface ReactionUpdatedPayload {
  channelId: string;
  messageId: string;
  reactions: Reaction[];
}

/**
 * "Something new in a channel": sent to everyone who can see the channel (workspace room for
 * public channels, members' user rooms for private ones), so sidebars can bump unread counts
 * for channels whose room they haven't joined. Small on purpose: no message body.
 */
export interface ChannelActivityPayload {
  workspaceId: string;
  channelId: string;
  messageId: string;
  authorId: string;
  mentionedUserIds: string[];
}

/** Sent to your own tabs when one of them marks a channel read. */
export interface ChannelReadPayload {
  channelId: string;
  lastReadMessageId: string;
}

/**
 * A piece of an `@ai` answer, to everyone in the channel room. `offset` = where `delta` starts
 * in the full text: a client appends it only if its copy is exactly `offset` long; otherwise it
 * missed earlier pieces (joined mid-answer) and waits for the final message:updated.
 */
export interface AiChunkPayload {
  channelId: string;
  messageId: string;
  delta: string;
  offset: number;
}

/**
 * An `@ai` answer failed (or couldn't start). The bot message (if any) is removed for everyone;
 * the asker's client shows `error` with a retry under their question.
 */
export interface AiFailedPayload {
  channelId: string;
  /** The removed bot message, or null if none was created (e.g. you already have one running). */
  messageId: string | null;
  questionId: string;
  askedById: string;
  error: SocketError;
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
  'message:edit': (payload: EditMessageInput, ack: AckCallback<{ message: PublicMessage }>) => void;
  'message:delete': (payload: MessageRef, ack: AckCallback<{ message: PublicMessage }>) => void;
  'reaction:toggle': (
    payload: ToggleReactionInput,
    ack: AckCallback<{ reactions: Reaction[] }>,
  ) => void;
  'ai:retry': (payload: AiRetryInput, ack: AckCallback) => void;
}

export interface ServerToClientEvents {
  'message:new': (payload: MessageNewPayload) => void;
  'typing:update': (payload: TypingUpdatePayload) => void;
  'presence:update': (payload: PresenceUpdatePayload) => void;
  'workspace:added': (payload: WorkspaceAddedPayload) => void;
  'message:updated': (payload: MessageUpdatedPayload) => void;
  'message:deleted': (payload: MessageDeletedPayload) => void;
  'reaction:updated': (payload: ReactionUpdatedPayload) => void;
  'channel:activity': (payload: ChannelActivityPayload) => void;
  'channel:read': (payload: ChannelReadPayload) => void;
  'ai:chunk': (payload: AiChunkPayload) => void;
  'ai:failed': (payload: AiFailedPayload) => void;
}
