import { ROLES } from '@teamchat/shared';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

// The role lives HERE, not on User: one person can be owner of one workspace and member of
// another (RBAC scoped per workspace).
const membershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true, default: 'member' },
  },
  { timestamps: true },
);

// One membership per (workspace, user). Also serves "is this user in this workspace?" checks,
// and its workspaceId prefix serves "list this workspace's members".
membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
// "Which workspaces am I in?"
membershipSchema.index({ userId: 1 });

export type MembershipAttrs = InferSchemaType<typeof membershipSchema>;
export type MembershipDocument = HydratedDocument<MembershipAttrs>;

export const Membership = model('Membership', membershipSchema);
