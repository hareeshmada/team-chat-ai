import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    // URL-friendly id, e.g. "acme-k3x9q2". Unique across all workspaces.
    slug: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export type WorkspaceAttrs = InferSchemaType<typeof workspaceSchema>;
export type WorkspaceDocument = HydratedDocument<WorkspaceAttrs>;

export const Workspace = model('Workspace', workspaceSchema);
