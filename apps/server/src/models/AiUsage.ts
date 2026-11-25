import { AI_FEATURES } from '@teamchat/shared';
import { model, Schema, type InferSchemaType } from 'mongoose';

/**
 * One row per AI call (panel question, @ai answer, channel summary): the permanent record for
 * cost reports. The daily limit is checked against a Redis counter instead (one O(1) read per
 * request rather than summing these rows).
 */
const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    feature: { type: String, enum: AI_FEATURES, required: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true },
    outputTokens: { type: Number, required: true },
    /** Gemini sent no token counts (the answer was stopped early): counted from text length. */
    estimated: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "My usage over time" (reports; a fallback count if the Redis counter is ever lost).
aiUsageSchema.index({ userId: 1, createdAt: -1 });

export type AiUsageAttrs = InferSchemaType<typeof aiUsageSchema>;

export const AiUsage = model('AiUsage', aiUsageSchema);
