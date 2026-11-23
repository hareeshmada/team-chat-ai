import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { socketAuth } from './auth.js';
import { registerChannelHandlers } from './handlers/channel.js';
import { registerMessageHandlers } from './handlers/message.js';
import { registerPresenceHandlers } from './handlers/presence.js';
import { registerTypingHandlers } from './handlers/typing.js';
import { createPresenceStore } from './presence.js';
import { createSocketRateLimiter } from './rateLimit.js';
import type { IoServer } from './types.js';

export interface SocketServerOptions {
  /** message:send budget per user (default 10 per 10 s). */
  messageLimit?: { limit: number; windowMs: number };
}

/**
 * Socket.IO on the same HTTP server (and port) as Express. Every connection is authenticated
 * in the handshake; every incoming event is validated with the shared Zod schemas.
 * Presence and the rate limiter are created per server, so tests get a clean state.
 */
export function createSocketServer(
  httpServer: HttpServer,
  { messageLimit = { limit: 10, windowMs: 10_000 } }: SocketServerOptions = {},
): IoServer {
  const io: IoServer = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
    maxHttpBufferSize: 100_000, // same cap as express.json (default is 1 MB)
  });

  const presence = createPresenceStore();
  const sendLimit = createSocketRateLimiter(messageLimit);

  io.use(socketAuth);

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    logger.debug({ userId, socketId: socket.id }, 'socket connected');

    registerPresenceHandlers(io, socket, presence);
    registerChannelHandlers(socket);
    registerMessageHandlers(io, socket, sendLimit);
    registerTypingHandlers(socket);

    socket.on('disconnect', (reason) => {
      logger.debug({ userId, socketId: socket.id, reason }, 'socket disconnected');
    });
  });

  return io;
}
