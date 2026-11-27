import { INVITE_EMAIL_STATUSES, INVITE_STATUSES } from '@teamchat/shared';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * A pending invite for an email with no account yet (Step 5.2).
 *
 * The link's token is never stored: it is an HMAC of (invite id, nonce) with a server secret, so
 * the worker can rebuild it when it sends the email, and only its SHA-256 hash is saved here for
 * lookups. Re-inviting changes the nonce, which kills the old link.
 */
const inviteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['admin', 'member'], required: true, default: 'member' },
    invitedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    nonce: { type: String, required: true },
    tokenHash: { type: String, required: true },
    status: { type: String, enum: INVITE_STATUSES, required: true, default: 'pending' },
    emailStatus: { type: String, enum: INVITE_EMAIL_STATUSES, required: true, default: 'sending' },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One pending invite per (workspace, email): inviting again re-sends it instead of duplicating.
inviteSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
// The invite modal's list (newest first).
inviteSchema.index({ workspaceId: 1, _id: -1 });
// Opening a link.
inviteSchema.index({ tokenHash: 1 }, { unique: true });

export type InviteAttrs = InferSchemaType<typeof inviteSchema>;
export type InviteDocument = HydratedDocument<InviteAttrs>;

export const Invite = model('Invite', inviteSchema);
