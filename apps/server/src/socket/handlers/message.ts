import {
  aiRetrySchema,
  editMessageSchema,
  isAiQuestion,
  messageRefSchema,
  sendMessageSchema,
  SOCKET_EVENTS,
  toggleReactionSchema,
} from '@teamchat/shared';
import { AppError } from '../../errors/AppError.js';
import { assertChannelAccess } from '../../services/access.service.js';
import {
  createMessage,
  getOwnAiQuestion,
  deleteMessage,
  editMessage,
  toggleReaction,
} from '../../services/message.service.js';
import { logger } from '../../lib/logger.js';
import { queueLinkPreview } from '../../services/linkPreview.service.js';
import { notifyMentions } from '../../services/notification.service.js';
import { resolveAttachments } from '../../services/upload.service.js';
import { runAiReply } from '../aiReply.js';
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
    handle(sendMessageSchema, async ({ channelId, body, tempId, attachments }) => {
      const { userId } = socket.data;
      takeBudget();

      // Checked on every send (not only on join): access can change while the socket is open.
      const { channel } = await assertChannelAccess(userId, channelId);
      // Files were uploaded straight to Cloudinary; look up what was really stored there.
      const files = attachments.length ? await resolveAttachments(userId, attachments) : [];
      const message = await createMessage(channel, userId, body, files);

      // Save first, then broadcast: nobody sees a message that isn't stored.
      // io.to (not socket.to) includes the sender's own tabs; they de-duplicate by tempId.
      io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.messageNew, { message, tempId });
      // Everyone else who can see the channel: unread badges.
      notifyChannelActivity(channel, message);
      // Mentioned people get a saved notification (SSE). Never fails the send.
      notifyMentions(message, channel).catch((err: unknown) =>
        logger.error({ err }, 'mention notifications failed'),
      );
      // A link → the worker fetches its preview; the card arrives later as message:updated.
      queueLinkPreview(message);
      // "@ai …": the bot answers in the channel. Runs after the ack (never delays the send).
      if (isAiQuestion(body)) {
        setImmediate(() => void runAiReply(io, channel, message, userId));
      }
      return { message };
    }),
  );

  // Ask again for one of your own @ai messages (after "Couldn't finish this answer").
  socket.on(
    SOCKET_EVENTS.aiRetry,
    handle(aiRetrySchema, async ({ questionId }) => {
      const { userId } = socket.data;
      takeBudget();
      const question = await getOwnAiQuestion(userId, questionId);
      const { channel } = await assertChannelAccess(userId, question.channelId);
      setImmediate(
        () => void runAiReply(io, channel, { id: question.id, body: question.body }, userId),
      );
      return {};
    }),
  );

  socket.on(
    SOCKET_EVENTS.messageEdit,
    handle(editMessageSchema, async ({ messageId, body }) => {
      takeBudget();
      const { message, channel, previouslyMentioned } = await editMessage(
        socket.data.userId,
        messageId,
        body,
      );
      io.to(channelRoom(message.channelId)).emit(SOCKET_EVENTS.messageUpdated, { message });
      // The first link changed (its old preview was removed) → fetch the new one.
      queueLinkPreview(message);
      // Only people mentioned for the FIRST time by this edit are notified.
      notifyMentions(message, channel, previouslyMentioned).catch((err: unknown) =>
        logger.error({ err }, 'mention notifications failed'),
      );
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
