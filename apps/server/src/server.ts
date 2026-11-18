import { APP_NAME } from '@teamchat/shared';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { logger } from './lib/logger.js';

try {
  await connectDb(env.MONGODB_URI, env.MONGODB_DB_NAME);
} catch (err) {
  logger.fatal({ err }, 'Failed to connect to MongoDB');
  process.exit(1);
}

const server = createApp().listen(env.PORT, () => {
  logger.info(`${APP_NAME} server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await disconnectDb();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
