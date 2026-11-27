import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject, vi } from 'vitest';
import type * as Queues from '../src/jobs/queues.js';
import { fakeRedis } from './helpers/fakeRedis.js';

// Every test file gets the in-memory Redis (no Redis server needed).
vi.mock('../src/lib/redis.js', () => ({
  getRedis: () => fakeRedis,
  closeRedis: async () => {},
}));

// BullMQ needs a real Redis: tests never queue jobs, they check what would be queued
// (invites.test.ts) and call the job processors directly.
vi.mock('../src/jobs/queues.js', async (importOriginal) => ({
  ...(await importOriginal<typeof Queues>()),
  enqueueInviteEmail: vi.fn(async () => {}),
}));

// Must be set before src/config/env.ts is imported by any test file.
process.env.MONGODB_URI = inject('mongoUri');
// Vitest runs test files in parallel workers: give each worker its own database so one
// file's afterEach cleanup can't delete another file's data mid-test.
process.env.MONGODB_DB_NAME = `teamchat-test-${process.env.VITEST_POOL_ID ?? '0'}`;
process.env.JWT_ACCESS_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';
// Tests don't depend on the developer's .env (dotenv never overrides variables already set).
process.env.AI_USAGE_TIMEZONE = 'UTC';
// Fake Cloudinary account: uploads.test.ts mocks the API calls; signing is local (no network).
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-cloudinary-secret';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME,
  });
  // Build indexes (e.g. unique email) before any test runs, so uniqueness is deterministic.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
});

afterEach(async () => {
  fakeRedis.reset();
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
