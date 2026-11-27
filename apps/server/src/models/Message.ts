import { AI_MESSAGE_STATUSES, ATTACHMENT_KINDS } from '@teamchat/shared';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** A file uploaded to Cloudinary (Step 5.1). Every number here came from Cloudinary, not the client. */
const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    /** Cloudinary's id: needed to delete the file when the message is deleted. */
    publicId: { type: String, required: true },
    kind: { type: String, enum: ATTACHMENT_KINDS, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

/** Preview of the message's first link, saved by the link-preview job (Step 5.2). */
const linkPreviewSchema = new Schema(
  {
    url: { type: String, required: true },
    domain: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
  },
  { _id: false },
);

const reactionSchema = new Schema(
  {
    emoji: { type: String, required: true },
    userIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { _id: false },
);

/** Only on AI bot messages (authorId = AI_BOT_ID): who asked, which message, progress. */
const aiInfoSchema = new Schema(
  {
    askedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    status: { type: String, enum: AI_MESSAGE_STATUSES, required: true },
    contextCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Not `required`: a soft-deleted message keeps its row with an empty body.
    body: { type: String, default: '', maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    reactions: { type: [reactionSchema], default: [] },
    linkPreview: { type: linkPreviewSchema, default: undefined },
    mentionedUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    ai: { type: aiInfoSchema, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// History query: find({ channelId, _id: { $lt: cursor } }).sort({ _id: -1 }).limit(n)
// The index matches the filter (channelId) AND the sort (_id desc), so MongoDB walks the
// index in order and stops after n entries: no in-memory sort, no scanning other channels.
messageSchema.index({ channelId: 1, _id: -1 });

// One uploaded file belongs to ONE message (deleting that message deletes the file, so reusing
// its public id in a second message would leave that one pointing at nothing). Unique across
// documents; partial, so the many messages without files aren't in the index at all.
messageSchema.index(
  { 'attachments.publicId': 1 },
  { unique: true, partialFilterExpression: { 'attachments.publicId': { $exists: true } } },
);

export type MessageAttrs = InferSchemaType<typeof messageSchema>;
export type MessageDocument = HydratedDocument<MessageAttrs>;

export const Message = model('Message', messageSchema);
