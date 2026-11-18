import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

// Must be set before src/config/env.ts is imported by any test file.
process.env.MONGODB_URI = inject('mongoUri');
process.env.MONGODB_DB_NAME = 'teamchat-test';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME,
  });
});

afterEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
