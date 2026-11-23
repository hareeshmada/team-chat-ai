import { sendMessageSchema, SOCKET_EVENTS } from '@teamchat/shared';
import { AppError } from '../../errors/AppError.js';
import { assertChannelAccess } from '../../services/access.service.js';
import { createMessage } from '../../services/message.service.js';
import { handle } from '../handle.js';
import type { createSocketRateLimiter } from '../rateLimit.js';
import { channelRoom, type IoServer, type IoSocket } from '../types.js';

export function registerMessageHandlers(
  io: IoServer,
  socket: IoSocket,
  sendLimit: ReturnType<typeof createSocketRateLimiter>,
) {
  socket.on(
    SOCKET_EVENTS.messageSend,
    handle(sendMessageSchema, async ({ channelId, body, tempId }) => {
      const { userId } = socket.data;
      // Keyed by user, so opening more tabs doesn't buy more budget.
      if (!sendLimit.take(userId)) {
        throw new AppError(429, 'RATE_LIMITED', 'You are sending messages too fast');
      }

      // Checked on every send (not only on join): access can change while the socket is open.
      const { channel } = await assertChannelAccess(userId, channelId);
      const message = await createMessage(channel._id, userId, body);

      // Save first, then broadcast: nobody sees a message that isn't stored.
      // io.to (not socket.to) includes the sender's own tabs; they de-duplicate by tempId.
      io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.messageNew, { message, tempId });
      return { message };
    }),
  );
}
