import { z } from 'zod';
import { roleSchema, workspaceMemberSchema } from './workspace.js';

/**
 * Pending invites (Step 5.2). Inviting an email that has no account yet creates an invite and
 * an `invite-email` job; the email carries a link `/invite/<token>`. Opening it while signed out
 * shows sign-up with the email locked; signing up (or accepting while signed in) joins the
 * workspace. Only the link proves the person owns the mailbox (emails aren't verified), so an
 * invite is never accepted by email match alone.
 */

export const INVITE_STATUSES = ['pending', 'accepted'] as const;
/** The invite-email job's progress, shown in the invite modal. */
export const INVITE_EMAIL_STATUSES = ['sending', 'sent', 'failed'] as const;
/** How long an invite link stays valid. */
export const INVITE_TTL_DAYS = 7;

export const publicInviteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  email: z.string(),
  role: roleSchema,
  status: z.enum(INVITE_STATUSES),
  emailStatus: z.enum(INVITE_EMAIL_STATUSES),
  createdAt: z.iso.datetime(),
});

/** POST /workspaces/:id/members: an existing account is added at once, any other email is invited. */
export const inviteResultSchema = z.union([
  z.object({ member: workspaceMemberSchema }),
  z.object({ invite: publicInviteSchema }),
]);

export const inviteListResponseSchema = z.object({ invites: z.array(publicInviteSchema) });

/** Invite tokens are 32 random-looking bytes, base64url (43 characters). */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid invite link');
export const inviteTokenParamsSchema = z.object({ token: inviteTokenSchema });

/** GET /api/invites/:token (public): what the sign-up banner needs. */
export const invitePreviewSchema = z.object({
  email: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  invitedByName: z.string(),
  role: roleSchema,
});
export const invitePreviewResponseSchema = z.object({ invite: invitePreviewSchema });

/** POST /api/invites/:token/accept (signed in): the workspace you joined. */
export const acceptInviteResponseSchema = z.object({ workspaceId: z.string() });

export type PublicInvite = z.infer<typeof publicInviteSchema>;
export type InviteResult = z.infer<typeof inviteResultSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
export type InviteStatus = (typeof INVITE_STATUSES)[number];
export type InviteEmailStatus = (typeof INVITE_EMAIL_STATUSES)[number];
