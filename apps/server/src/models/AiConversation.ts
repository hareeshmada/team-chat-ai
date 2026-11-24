import { AI_ROLES } from '@teamchat/shared';
import { model, Schema, type InferSchemaType, type Types } from 'mongoose';

/**
 * One turn of an assistant conversation. Roles are provider-neutral ('assistant', not Gemini's
 * 'model'): only ai.service.ts knows the provider's names.
 */
const aiMessageSchema = new Schema(
  {
    role: { type: String, enum: AI_ROLES, required: true },
    content: { type: String, required: true },
    /** The user stopped the answer (or disconnected) before it finished: content is partial. */
    stopped: { type: Boolean, default: undefined },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** The first question, shortened: the label in the conversation list (Step 4.2). */
    title: { type: String, required: true },
    messages: { type: [aiMessageSchema], default: [] },
  },
  { timestamps: true },
);

// "My conversations, most recent first" (Step 4.2's list).
aiConversationSchema.index({ userId: 1, updatedAt: -1 });

export type AiConversationAttrs = InferSchemaType<typeof aiConversationSchema>;
export type AiConversationLean = AiConversationAttrs & { _id: Types.ObjectId };

export const AiConversation = model('AiConversation', aiConversationSchema);
