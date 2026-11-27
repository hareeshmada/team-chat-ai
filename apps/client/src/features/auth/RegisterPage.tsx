import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type InvitePreview, type RegisterInput } from '@teamchat/shared';
import type { ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Divider } from '../../components/ui/Divider';
import { FormError } from '../../components/ui/FormError';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { TerminalCard } from '../../components/ui/TerminalCard';
import { AuthLayout, SoonTag } from './AuthLayout';
import { FeaturesShowcase } from './BrandShowcase';
import { PasswordStrength } from './PasswordStrength';
import { applyServerError } from './serverErrors';
import { register as registerUser } from './session';

export interface RegisterPageProps {
  /** Opened from an invite link (Step 5.2): banner, email prefilled and locked, token sent. */
  invite?: { token: string; preview: InvitePreview };
  /** Shown above the form instead (e.g. "this invite link has expired"). */
  notice?: ReactNode;
}

export function RegisterPage({ invite, notice }: RegisterPageProps = {}) {
  // From /invite/:token, "Sign in" comes back to the link (signed in, it joins the workspace).
  const location = useLocation();
  const signInState = invite ? { from: location } : undefined;
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: invite?.preview.email ?? '', password: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser(invite ? { ...values, inviteToken: invite.token } : values);
    } catch (err) {
      applyServerError(err, setError, ['name', 'email', 'password'], { EMAIL_TAKEN: 'email' });
    }
  });

  const emailError =
    errors.email?.type === 'EMAIL_TAKEN' ? (
      <>
        An account with this email already exists.{' '}
        <Link to="/login" state={signInState} className="underline">
          Sign in instead
        </Link>
      </>
    ) : (
      errors.email?.message
    );

  return (
    <AuthLayout headline="Set up your team in under a minute." showcase={<FeaturesShowcase />}>
      {invite && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-border-strong bg-surface px-3.5 py-3 text-[13px]">
          <Avatar name={invite.preview.invitedByName} tone="accent" />
          <span>
            <span className="font-semibold">{invite.preview.invitedByName}</span> invited you to{' '}
            <span className="font-mono">{invite.preview.workspaceName}</span>. Create your account
            to join.
          </span>
        </div>
      )}
      {notice}
      <TerminalCard title="teamchat register" prompt>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <h1 className="text-[22px] leading-[1.3] font-semibold">Create your account</h1>
            <p className="mt-1 text-muted">Free for teams of any size.</p>
          </div>

          {errors.root?.server && <FormError>{errors.root.server.message}</FormError>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="register-name">name</Label>
            <Input
              id="register-name"
              autoComplete="name"
              placeholder="Your name"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="register-email">email</Label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              // The invite is for this address: the link is the proof they own it.
              readOnly={Boolean(invite)}
              aria-describedby={invite ? 'register-email-locked' : undefined}
              error={emailError}
              {...register('email')}
            />
            {invite && (
              <p id="register-email-locked" className="text-xs text-muted">
                The invite was sent to this address.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="register-password">password</Label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              aria-describedby="register-password-hint"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordStrength password={password} hintId="register-password-hint" />
          </div>

          <Button type="submit" enterHint={!isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>

          <Divider label="or" />

          {/* Google sign-in is not built yet (PLAN Step 7.5). */}
          <Button variant="secondary" disabled title="Google sign-in is coming soon">
            Continue with Google <SoonTag />
          </Button>
        </form>
      </TerminalCard>

      <p className="text-center text-muted">
        Already have an account?{' '}
        <Link
          to="/login"
          state={signInState}
          className="font-semibold text-accent-fg hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
