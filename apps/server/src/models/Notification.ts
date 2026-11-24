import { NOTIFICATION_TYPES } from '@teamchat/shared';
import { model, Schema, type InferSchemaType, type Types } from 'mongoose';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    // Shape depends on `type`; validated with the shared Zod schemas before it is saved.
    payload: { type: Schema.Types.Mixed, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

// "My notifications, newest first" (list + cursor) and "mine newer than Last-Event-ID" (replay):
// both are a range on _id inside one user's slice of this index.
notificationSchema.index({ userId: 1, _id: -1 });

export type NotificationAttrs = InferSchemaType<typeof notificationSchema>;
export type NotificationLean = NotificationAttrs & { _id: Types.ObjectId; createdAt: Date };

export const Notification = model('Notification', notificationSchema);
