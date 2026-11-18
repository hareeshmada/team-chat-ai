import mongoose, { Schema } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectDb } from '../src/lib/db.js';

// Test-only model: proves the in-memory MongoDB is wired up. Not part of the app.
const SampleModel = mongoose.model(
  'Sample',
  new Schema({ name: { type: String, required: true } }),
);

describe('in-memory MongoDB', () => {
  it('writes and reads a document', async () => {
    await SampleModel.create({ name: 'general' });

    const found = await SampleModel.findOne({ name: 'general' }).lean();

    expect(found?.name).toBe('general');
  });

  it('starts each test with empty collections', async () => {
    expect(await SampleModel.countDocuments()).toBe(0);
  });
});

function namedError(name: string, message = name): Error {
  return Object.assign(new Error(message), { name });
}

describe('connectDb() retry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries transient errors and succeeds', async () => {
    const connect = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(namedError('MongooseServerSelectionError'))
      .mockRejectedValueOnce(namedError('MongoNetworkError'))
      .mockResolvedValueOnce(mongoose);

    await connectDb('mongodb://example', 'db', { retries: 5, baseDelayMs: 1 });

    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt with a clear message', async () => {
    const connect = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValue(namedError('MongooseServerSelectionError', 'connect ECONNREFUSED'));

    await expect(
      connectDb('mongodb://example', 'db', { retries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('Could not connect to MongoDB after 3 attempts: connect ECONNREFUSED');
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('fails fast without retrying on a non-transient error (bad URI)', async () => {
    const connect = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValue(namedError('MongoParseError', 'Invalid scheme'));

    await expect(
      connectDb('mongodb://example', 'db', { retries: 5, baseDelayMs: 1 }),
    ).rejects.toThrow('Invalid scheme');
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
