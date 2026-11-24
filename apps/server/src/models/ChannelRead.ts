import { model, Schema, type InferSchemaType } from 'mongoose';

/**
 * Per user and channel: the newest message they have seen. Unread = messages in the channel
 * with an _id greater than this (ObjectIds grow over time), so the count is a range scan on
 * the { channelId: 1, _id: -1 } message index, with no per-message "read by" lists.
 */
const channelReadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

// One marker per user and channel; also serves "all my markers" (prefix userId).
channelReadSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export type ChannelReadAttrs = InferSchemaType<typeof channelReadSchema>;

export const ChannelRead = model('ChannelRead', channelReadSchema);
