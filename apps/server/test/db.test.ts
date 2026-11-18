import mongoose, { Schema } from 'mongoose';
import { describe, expect, it } from 'vitest';

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
