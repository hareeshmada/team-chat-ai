import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

// Must be set before src/config/env.ts is imported by any test file.
process.env.MONGODB_URI = inject('mongoUri');
// Vitest runs test files in parallel workers: give each worker its own database so one
// file's afterEach cleanup can't delete another file's data mid-test.
process.env.MONGODB_DB_NAME = `teamchat-test-${process.env.VITEST_POOL_ID ?? '0'}`;
process.env.JWT_ACCESS_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME,
  });
  // Build indexes (e.g. unique email) before any test runs, so uniqueness is deterministic.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
