import { inviteEmail } from '../emails/inviteEmail.js';
import type { SendMail } from '../lib/mailer.js';
import { publishEvent } from '../lib/pubsub.js';
import { Invite } from '../models/Invite.js';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { inviteLink } from '../services/invite.service.js';
import type { InviteEmailJobData } from './queues.js';

/**
 * The `invite-email` job (runs in the worker). BullMQ retries it (3 tries, backoff) when it
 * throws, so it must be safe to run more than once: it re-reads the invite every time and does
 * nothing if the email was already sent, the invite was accepted, or a newer invite (new nonce)
 * replaced it. Mongo is the source of truth, not the job's data.
 *
 * What it can't make exactly-once: if the SMTP server accepts the email and the process dies
 * before `emailStatus: 'sent'` is saved, the retry sends it again (at-least-once delivery).
 */

export interface InviteJobDeps {
  sendMail: SendMail;
  publish?: typeof publishEvent;
}

export type InviteJobResult = 'sent' | 'already-sent' | 'stale';

export async function processInviteEmail(
  data: InviteEmailJobData,
  { sendMail, publish = publishEvent }: InviteJobDeps,
): Promise<InviteJobResult> {
  const invite = await Invite.findById(data.inviteId);
  if (!invite || invite.status !== 'pending' || invite.nonce !== data.nonce) return 'stale';
  if (invite.emailStatus === 'sent') return 'already-sent';

  const [workspace, inviter] = await Promise.all([
    Workspace.findById(invite.workspaceId),
    User.findById(invite.invitedById),
  ]);
  if (!workspace) return 'stale';

  await sendMail(
    inviteEmail({
      to: invite.email,
      inviterName: inviter?.name ?? 'A teammate',
      workspaceName: workspace.name,
      role: invite.role,
      link: inviteLink(invite.nonce),
    }),
  );

  // Only this version of the invite: a re-invite meanwhile has its own job and status.
  await Invite.updateOne({ _id: invite._id, nonce: data.nonce }, { emailStatus: 'sent' });
  await publish({ type: 'invite:updated', inviteId: data.inviteId });
  return 'sent';
}

/** Called once the job has used all its tries: the modal shows "email failed after 3 tries". */
export async function markInviteEmailFailed(
  data: InviteEmailJobData,
  publish: typeof publishEvent = publishEvent,
): Promise<void> {
  const res = await Invite.updateOne(
    { _id: data.inviteId, nonce: data.nonce, status: 'pending', emailStatus: 'sending' },
    { emailStatus: 'failed' },
  );
  if (res.modifiedCount) await publish({ type: 'invite:updated', inviteId: data.inviteId });
}
