import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    editedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// History query: find({ channelId, _id: { $lt: cursor } }).sort({ _id: -1 }).limit(n)
// The index matches the filter (channelId) AND the sort (_id desc), so MongoDB walks the
// index in order and stops after n entries: no in-memory sort, no scanning other channels.
messageSchema.index({ channelId: 1, _id: -1 });

export type MessageAttrs = InferSchemaType<typeof messageSchema>;
export type MessageDocument = HydratedDocument<MessageAttrs>;

export const Message = model('Message', messageSchema);
