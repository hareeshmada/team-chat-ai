import { mongo } from 'mongoose';

/** E11000: a unique index rejected the write. */
export function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof mongo.MongoServerError && err.code === 11000;
}
