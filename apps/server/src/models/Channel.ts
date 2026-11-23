import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const channelSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, lowercase: true, trim: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 250, default: '' },
    isPrivate: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Private channels only: who may see it (a relationship check on top of the workspace role).
    // Public channels leave it empty: every workspace member can see them.
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true },
);

// Channel names are unique within a workspace; the prefix also serves "list channels".
channelSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export type ChannelAttrs = InferSchemaType<typeof channelSchema>;
export type ChannelDocument = HydratedDocument<ChannelAttrs>;

export const Channel = model('Channel', channelSchema);
