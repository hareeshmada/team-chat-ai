import { zodResolver } from '@hookform/resolvers/zod';
import {
  inviteMemberSchema,
  type InviteMemberInput,
  type PublicWorkspace,
  type WorkspaceMember,
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
import { Tag } from '../../components/ui/Tag';
import { applyServerError } from '../auth/serverErrors';
import { useInviteMember } from '../chat/queries';

/** Adds an existing account by email (admin+). Stays open so several people can be added. */
export function InviteMemberModal({
  workspace,
  onClose,
}: {
  workspace: PublicWorkspace;
  onClose: () => void;
}) {
  const invite = useInviteMember(workspace.id);
  const [added, setAdded] = useState<WorkspaceMember[]>([]);
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
    try {
      const member = await invite.mutateAsync(values);
      setAdded((prev) => [member, ...prev]);
      reset({ email: '', role: values.role });
    } catch (err) {
      applyServerError(err, setError, ['email', 'role'], {
        USER_NOT_FOUND: 'email',
        ALREADY_MEMBER: 'email',
      });
    }
  });

  const emailError =
    errors.email?.type === 'USER_NOT_FOUND'
      ? 'No TeamChat account uses this email. Ask them to sign up first.'
      : errors.email?.message;

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
            {isSubmitting ? 'Adding…' : 'Add member'}
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
              placeholder="teammate@company.com"
              error={emailError}
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

      {added.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] text-muted">added just now</span>
          <ul className="flex flex-col gap-1.5" aria-live="polite">
            {added.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2 text-[13px]"
              >
                <Check size={14} strokeWidth={2.5} aria-hidden className="text-success" />
                <span className="min-w-0 flex-1 truncate font-mono">{m.email}</span>
                <Tag>{m.role}</Tag>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
