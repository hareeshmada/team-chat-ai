import mongoose from 'mongoose';
import { logger } from './logger.js';

export async function connectDb(uri: string, dbName: string): Promise<void> {
  await mongoose.connect(uri, { dbName });
  // Never log the URI itself: it contains credentials.
  const { host, name } = mongoose.connection;
  logger.info(`MongoDB connected (host ${host}, db ${name})`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
