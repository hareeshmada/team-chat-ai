import {
  editMessageSchema,
  messageRefSchema,
  sendMessageSchema,
  SOCKET_EVENTS,
  toggleReactionSchema,
} from '@teamchat/shared';
import { AppError } from '../../errors/AppError.js';
import { assertChannelAccess } from '../../services/access.service.js';
import {
  createMessage,
  deleteMessage,
  editMessage,
  toggleReaction,
} from '../../services/message.service.js';
import { handle } from '../handle.js';
import type { createSocketRateLimiter } from '../rateLimit.js';
import { notifyChannelActivity } from '../realtime.js';
import { channelRoom, type IoServer, type IoSocket } from '../types.js';

export function registerMessageHandlers(
  io: IoServer,
  socket: IoSocket,
  sendLimit: ReturnType<typeof createSocketRateLimiter>,
) {
  /** Every write shares one budget per user, so opening more tabs doesn't buy more. */
  const takeBudget = () => {
    if (!sendLimit.take(socket.data.userId)) {
      throw new AppError(429, 'RATE_LIMITED', 'You are sending messages too fast');
    }
  };

  socket.on(
    SOCKET_EVENTS.messageSend,
    handle(sendMessageSchema, async ({ channelId, body, tempId }) => {
      const { userId } = socket.data;
      takeBudget();

      // Checked on every send (not only on join): access can change while the socket is open.
      const { channel } = await assertChannelAccess(userId, channelId);
      const message = await createMessage(channel, userId, body);

      // Save first, then broadcast: nobody sees a message that isn't stored.
      // io.to (not socket.to) includes the sender's own tabs; they de-duplicate by tempId.
      io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.messageNew, { message, tempId });
      // Everyone else who can see the channel: unread badges.
      notifyChannelActivity(channel, message);
      return { message };
    }),
  );

  socket.on(
    SOCKET_EVENTS.messageEdit,
    handle(editMessageSchema, async ({ messageId, body }) => {
      takeBudget();
      const message = await editMessage(socket.data.userId, messageId, body);
      io.to(channelRoom(message.channelId)).emit(SOCKET_EVENTS.messageUpdated, { message });
      return { message };
    }),
  );

  socket.on(
    SOCKET_EVENTS.messageDelete,
    handle(messageRefSchema, async ({ messageId }) => {
      takeBudget();
      const message = await deleteMessage(socket.data.userId, messageId);
      io.to(channelRoom(message.channelId)).emit(SOCKET_EVENTS.messageDeleted, { message });
      return { message };
    }),
  );

  socket.on(
    SOCKET_EVENTS.reactionToggle,
    handle(toggleReactionSchema, async ({ messageId, emoji }) => {
      takeBudget();
      const { channelId, reactions } = await toggleReaction(socket.data.userId, messageId, emoji);
      io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.reactionUpdated, {
        channelId,
        messageId,
        reactions,
      });
      return { reactions };
    }),
  );
}
