import { zodResolver } from '@hookform/resolvers/zod';
import {
  createWorkspaceSchema,
  slugBase,
  type CreateWorkspaceInput,
  type PublicWorkspace,
} from '@teamchat/shared';
import { useForm, useWatch } from 'react-hook-form';
import { FormError } from '../../components/ui/FormError';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { applyServerError } from '../auth/serverErrors';
import { useCreateWorkspace } from '../chat/queries';

export interface CreateWorkspaceFormProps {
  id: string;
  onCreated: (workspace: PublicWorkspace) => void;
  /** Rendered after the fields (onboarding puts its submit button here). */
  children?: (state: { isSubmitting: boolean }) => React.ReactNode;
  autoFocus?: boolean;
}

/** Name + URL preview + "we'll set up" box. Shared by onboarding and the switcher's modal. */
export function CreateWorkspaceForm({
  id,
  onCreated,
  children,
  autoFocus,
}: CreateWorkspaceFormProps) {
  const createWorkspace = useCreateWorkspace();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    mode: 'onTouched',
    defaultValues: { name: '' },
  });
  const name = useWatch({ control, name: 'name' });

  const onSubmit = handleSubmit(async (values) => {
    try {
      onCreated(await createWorkspace.mutateAsync(values));
    } catch (err) {
      applyServerError(err, setError, ['name']);
    }
  });

  return (
    <form id={id} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.root?.server && <FormError>{errors.root.server.message}</FormError>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>workspace name</Label>
        <Input
          id={`${id}-name`}
          autoComplete="organization"
          placeholder="Acme Studio"
          autoFocus={autoFocus}
          aria-describedby={`${id}-slug`}
          error={errors.name?.message}
          {...register('name')}
        />
        {/* The server appends a random suffix to keep slugs unique (no availability check). */}
        <span id={`${id}-slug`} className="font-mono text-xs text-muted">
          url: teamchat/<span className="text-fg">{slugBase(name || 'your-team')}-…</span>
          <span> · a short suffix keeps it unique</span>
        </span>
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-[13px]">
        <span className="font-mono text-[11px] text-muted">we’ll set up</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-accent-fg">#general</span>
          <span className="text-muted">for everyone</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-accent-fg">#random</span>
          <span className="text-muted">for everything else</span>
        </span>
      </div>
      {children?.({ isSubmitting })}
    </form>
  );
}
