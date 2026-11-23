import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const ROLES = ['owner', 'admin', 'member'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** Higher number = more power. A role can do everything the roles below it can. */
export const ROLE_RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

export const workspaceParamsSchema = z.object({ workspaceId: objectIdSchema });

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
  // Owner is never granted by invite: ownership transfer is a separate, owner-only action.
  role: z.enum(['admin', 'member']).default('member'),
});

export const publicWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  ownerId: z.string(),
  role: roleSchema, // the requesting user's role in this workspace
  createdAt: z.iso.datetime(),
});

export const workspaceMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: roleSchema,
  joinedAt: z.iso.datetime(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type PublicWorkspace = z.infer<typeof publicWorkspaceSchema>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
