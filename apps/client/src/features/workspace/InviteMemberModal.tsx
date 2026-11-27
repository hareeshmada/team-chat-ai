import { zodResolver } from '@hookform/resolvers/zod';
import {
  inviteMemberSchema,
  type InviteMemberInput,
  type PublicInvite,
  type PublicWorkspace,
} from '@teamchat/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { FormError } from '../../components/ui/FormError';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { cn } from '../../lib/cn';
import { applyServerError } from '../auth/serverErrors';
import { useInviteMember, useInvites } from '../chat/queries';

/**
 * Invite by email (admin+). An existing account joins at once; any other email gets a pending
 * invite that the worker emails (Step 5.2). Stays open so several people can be invited; the
 * "invited" list updates live as emails are sent and invites accepted (`invite:updated`).
 */

type Row = { email: string; status: 'joined' | 'emailed' | 'sending' | 'failed' };

const rowStatus = (i: PublicInvite): Row['status'] =>
  i.status === 'accepted'
    ? 'joined'
    : i.emailStatus === 'sent'
      ? 'emailed'
      : i.emailStatus === 'failed'
        ? 'failed'
        : 'sending';

const statusText: Record<Row['status'], string> = {
  joined: 'joined',
  emailed: 'pending · emailed',
  sending: 'pending · sending…',
  failed: 'email failed after 3 tries',
};
const statusClass: Record<Row['status'], string> = {
  joined: 'text-success',
  emailed: 'text-warning',
  sending: 'text-muted',
  failed: 'text-danger',
};

type Notice = { kind: 'invited' | 'added'; email: string };

export function InviteMemberModal({
  workspace,
  onClose,
}: {
  workspace: PublicWorkspace;
  onClose: () => void;
}) {
  const invite = useInviteMember(workspace.id);
  const invites = useInvites(workspace.id);
  // Existing accounts added in this session (they have no invite row).
  const [added, setAdded] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    mode: 'onTouched',
    defaultValues: { email: '', role: 'member' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const result = await invite.mutateAsync(values);
      if ('member' in result) {
        setAdded((prev) => [result.member.email, ...prev.filter((e) => e !== result.member.email)]);
        setNotice({ kind: 'added', email: result.member.email });
      } else if (result.invite.emailStatus !== 'failed') {
        setNotice({ kind: 'invited', email: result.invite.email });
      }
      reset({ email: '', role: values.role });
    } catch (err) {
      applyServerError(err, setError, ['email', 'role'], { ALREADY_MEMBER: 'email' });
    }
  });

  const rows: Row[] = [
    ...added.map((email) => ({ email, status: 'joined' as const })),
    ...(invites.data ?? [])
      .filter((i) => !added.includes(i.email))
      .map((i) => ({ email: i.email, status: rowStatus(i) })),
  ];

  return (
    <Modal
      title={
        <>
          Invite to <span className="font-mono">{workspace.name}</span>
        </>
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="h-10" onClick={onClose}>
            Done
          </Button>
          <Button
            type="submit"
            form="invite-member"
            enterHint={!isSubmitting}
            disabled={isSubmitting}
            className="h-10"
          >
            {isSubmitting ? 'Sending…' : 'Send invite'}
          </Button>
        </>
      }
    >
      <form id="invite-member" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {errors.root?.server && <FormError>{errors.root.server.message}</FormError>}
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
            <Label htmlFor="invite-email">email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="name@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
          <div className="flex flex-[0_1_120px] flex-col gap-1.5">
            <Label htmlFor="invite-role">role</Label>
            <Select id="invite-role" {...register('role')}>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </Select>
          </div>
        </div>
      </form>

      {notice && (
        <div
          role="status"
          className="flex gap-2.5 rounded-md border border-success/35 bg-success-soft px-3 py-2.5 text-[13px]"
        >
          <Check
            size={14}
            strokeWidth={2.5}
            aria-hidden
            className="mt-[3px] shrink-0 text-success"
          />
          {notice.kind === 'invited' ? (
            <span>
              Invite emailed to <span className="font-mono">{notice.email}</span>. They’ll join as
              soon as they sign up.
            </span>
          ) : (
            <span>
              <span className="font-mono">{notice.email}</span> already has an account and was added
              to the workspace.
            </span>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] text-muted">invited</span>
          <ul className="flex flex-col gap-1.5" aria-live="polite">
            {rows.map((r) => (
              <li
                key={r.email}
                className={cn(
                  'flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-[13px]',
                  r.status === 'failed' ? 'border-danger/35 bg-danger/6' : 'border-border',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-mono">{r.email}</span>
                <span className={cn('shrink-0 font-mono text-[11px]', statusClass[r.status])}>
                  {statusText[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
