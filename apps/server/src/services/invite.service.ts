import { createHmac, randomBytes } from 'node:crypto';
import {
  INVITE_TTL_DAYS,
  type InvitePreview,
  type PublicInvite,
  type PublicWorkspace,
} from '@teamchat/shared';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { enqueueInviteEmail } from '../jobs/queues.js';
import { logger } from '../lib/logger.js';
import { isDuplicateKeyError } from '../lib/mongoErrors.js';
import { Invite, type InviteDocument } from '../models/Invite.js';
import { Membership } from '../models/Membership.js';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { hashToken } from './token.service.js';

/**
 * Pending invites (Step 5.2): emails with no account yet. The API creates the invite and adds an
 * `invite-email` job; the worker sends the email (src/jobs/inviteEmail.job.ts).
 */

/**
 * The link token: HMAC(server secret, nonce), base64url (43 chars). Never stored and never put in
 * the job: the worker rebuilds it from the nonce. The DB holds only its SHA-256 hash, so a
 * database leak alone can't produce working links. (Rotating JWT_ACCESS_SECRET also invalidates
 * open invite links.)
 */
export function inviteToken(nonce: string): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(`invite:${nonce}`).digest('base64url');
}

export const inviteLink = (nonce: string) => `${env.CLIENT_ORIGIN}/invite/${inviteToken(nonce)}`;

export function toPublicInvite(invite: InviteDocument): PublicInvite {
  return {
    id: invite._id.toString(),
    workspaceId: invite.workspaceId.toString(),
    email: invite.email,
    role: invite.role,
    status: invite.status,
    emailStatus: invite.emailStatus,
    createdAt: invite.createdAt.toISOString(),
  };
}

const notFound = () =>
  new AppError(404, 'INVITE_NOT_FOUND', 'This invite link is invalid or has expired');

/**
 * Creates the pending invite for `email`, or renews it if one is already pending (new link,
 * new 7 days, email sent again): re-inviting is how an admin re-sends a failed email. Then
 * queues the email. If the queue is unreachable the invite is still saved, marked "failed".
 */
export async function createOrRenewInvite(
  workspaceId: string,
  email: string,
  role: 'admin' | 'member',
  invitedById: string,
): Promise<PublicInvite> {
  const nonce = randomBytes(16).toString('base64url');
  const upsert = () =>
    Invite.findOneAndUpdate(
      { workspaceId, email, status: 'pending' },
      {
        $set: {
          role,
          invitedById,
          nonce,
          tokenHash: hashToken(inviteToken(nonce)),
          emailStatus: 'sending',
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

  let invite: InviteDocument;
  try {
    invite = await upsert();
  } catch (err) {
    // Two invites for the same email at once: the unique partial index stops the second insert;
    // run it again as an update of the one that won.
    if (!isDuplicateKeyError(err)) throw err;
    invite = await upsert();
  }

  try {
    await enqueueInviteEmail({ inviteId: invite._id.toString(), nonce });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'invite email not queued');
    invite =
      (await Invite.findOneAndUpdate(
        { _id: invite._id, nonce },
        { emailStatus: 'failed' },
        { returnDocument: 'after' },
      )) ?? invite;
  }
  return toPublicInvite(invite);
}

/** The invite modal's "invited" list: pending (unexpired) and accepted, newest first, max 50. */
export async function listInvites(workspaceId: string): Promise<PublicInvite[]> {
  const invites = await Invite.find({
    workspaceId,
    $or: [{ status: 'accepted' }, { status: 'pending', expiresAt: { $gt: new Date() } }],
  })
    .sort({ _id: -1 })
    .limit(50);
  return invites.map(toPublicInvite);
}

async function findUsableInvite(token: string) {
  const invite = await Invite.findOne({ tokenHash: hashToken(token) });
  if (!invite || invite.expiresAt.getTime() <= Date.now()) return null;
  return invite;
}

/** GET /api/invites/:token (public): the sign-up banner. Used or expired links are a 404. */
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const invite = await findUsableInvite(token);
  if (!invite || invite.status !== 'pending') throw notFound();
  const [workspace, inviter] = await Promise.all([
    Workspace.findById(invite.workspaceId),
    User.findById(invite.invitedById),
  ]);
  if (!workspace) throw notFound();
  return {
    email: invite.email,
    workspaceId: workspace._id.toString(),
    workspaceName: workspace.name,
    invitedByName: inviter?.name ?? 'A teammate',
    role: invite.role,
  };
}

export interface AcceptedInvite {
  workspace: PublicWorkspace;
  invite: PublicInvite;
}

/**
 * Joins the invite's workspace. The invite must be for this user's email: the link proves they
 * can read that mailbox (emails aren't verified at sign-up, so an email match alone isn't
 * enough). Accepting the same link again is a no-op that returns the workspace.
 */
export async function acceptInvite(
  token: string,
  user: { id: string; email: string },
): Promise<AcceptedInvite> {
  const invite = await findUsableInvite(token);
  if (!invite) throw notFound();
  if (invite.status === 'accepted' && invite.acceptedById?.toString() !== user.id) throw notFound();
  if (invite.email !== user.email) {
    throw new AppError(403, 'INVITE_EMAIL_MISMATCH', `This invite was sent to ${invite.email}`);
  }

  // Membership first: if the next write fails, accepting again still works (duplicate ignored).
  await Membership.updateOne(
    { workspaceId: invite.workspaceId, userId: new Types.ObjectId(user.id) },
    { $setOnInsert: { role: invite.role } },
    { upsert: true },
  );
  const accepted =
    (await Invite.findOneAndUpdate(
      { _id: invite._id, status: 'pending' },
      { status: 'accepted', acceptedAt: new Date(), acceptedById: user.id },
      { returnDocument: 'after' },
    )) ?? invite;

  const workspace = await Workspace.findById(invite.workspaceId);
  if (!workspace) throw notFound();
  const membership = await Membership.findOne({ workspaceId: workspace._id, userId: user.id });
  return {
    workspace: {
      id: workspace._id.toString(),
      name: workspace.name,
      slug: workspace.slug,
      ownerId: workspace.ownerId.toString(),
      role: membership?.role ?? invite.role,
      createdAt: workspace.createdAt.toISOString(),
    },
    invite: toPublicInvite(accepted),
  };
}

/** Who sees an invite's live status: the workspace's admins and owner. */
export async function inviteAudience(
  inviteId: string,
): Promise<{ invite: PublicInvite; adminIds: string[] } | null> {
  const invite = await Invite.findById(inviteId);
  if (!invite) return null;
  const admins = await Membership.find(
    { workspaceId: invite.workspaceId, role: { $in: ['admin', 'owner'] } },
    { userId: 1 },
  ).lean();
  return { invite: toPublicInvite(invite), adminIds: admins.map((m) => m.userId.toString()) };
}
