import { createServer } from 'node:http';
import { APP_NAME } from '@teamchat/shared';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { logger } from './lib/logger.js';
import { closeRedis, connectRedis } from './lib/redis.js';
import { createSocketServer } from './socket/index.js';
import { closeAllStreams } from './sse/notificationStream.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

try {
  await connectDb(env.MONGODB_URI, env.MONGODB_DB_NAME);
} catch (err) {
  logger.fatal({ err }, 'Failed to connect to MongoDB');
  process.exit(1);
}

// Not fatal: without Redis the AI usage limit fails open (logged), everything else works.
await connectRedis();

// One HTTP server for both: Express handles normal requests, Socket.IO handles /socket.io
// (long-polling requests and the WebSocket upgrade) on the same port.
const server = createServer(createApp());
const io = createSocketServer(server);

server.on('error', (err) => {
  logger.fatal({ err }, `Could not listen on port ${env.PORT}`);
  void disconnectDb().finally(() => process.exit(1));
});
server.listen(env.PORT, () => {
  logger.info(`${APP_NAME} server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return; // second Ctrl+C while already shutting down
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);

  // Safety net: if something hangs (a stuck request, the DB), exit anyway.
  setTimeout(() => {
    logger.error(`Shutdown took longer than ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  try {
    // 1. Disconnect every socket, then stop accepting new connections (io.close() also closes
    //    the HTTP server); resolves once in-flight requests finish.
    const closed = io.close();
    // Idle keep-alive sockets and open SSE streams would otherwise keep close() waiting.
    server.closeIdleConnections();
    closeAllStreams();
    await closed;
    // 2. Only then close the DB: in-flight requests may still have needed it.
    await Promise.all([disconnectDb(), closeRedis()]);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
