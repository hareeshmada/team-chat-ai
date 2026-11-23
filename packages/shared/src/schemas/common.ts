import { z } from 'zod';

/** A MongoDB ObjectId as a 24-character hex string (validated before it reaches Mongoose). */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
