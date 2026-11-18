import { APP_NAME } from '@teamchat/shared';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { logger } from './lib/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

try {
  await connectDb(env.MONGODB_URI, env.MONGODB_DB_NAME);
} catch (err) {
  logger.fatal({ err }, 'Failed to connect to MongoDB');
  process.exit(1);
}

// Express 5 also calls this callback when listening fails (e.g. EADDRINUSE), with the error.
const server = createApp().listen(env.PORT, (err) => {
  if (err) {
    logger.fatal({ err }, `Could not listen on port ${env.PORT}`);
    void disconnectDb().finally(() => process.exit(1));
    return;
  }
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
    // 1. Stop accepting new connections; resolves once in-flight requests finish.
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      // Idle keep-alive sockets would otherwise keep close() waiting.
      server.closeIdleConnections();
    });
    // 2. Only then close the DB: in-flight requests may still have needed it.
    await disconnectDb();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
