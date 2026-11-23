import { channelRefSchema, SOCKET_EVENTS } from '@teamchat/shared';
import { assertChannelAccess } from '../../services/access.service.js';
import { handle } from '../handle.js';
import { channelRoom, type IoSocket } from '../types.js';

export function registerChannelHandlers(socket: IoSocket) {
  // Joining a room = "send me this channel's live events". Same access rule as HTTP history.
  socket.on(
    SOCKET_EVENTS.channelJoin,
    handle(channelRefSchema, async ({ channelId }) => {
      await assertChannelAccess(socket.data.userId, channelId);
      await socket.join(channelRoom(channelId));
      return {};
    }),
  );

  socket.on(
    SOCKET_EVENTS.channelLeave,
    handle(channelRefSchema, async ({ channelId }) => {
      await socket.leave(channelRoom(channelId));
      return {};
    }),
  );
}
