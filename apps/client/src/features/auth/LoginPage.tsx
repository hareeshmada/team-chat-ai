import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@teamchat/shared';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Divider } from '../../components/ui/Divider';
import { FormError } from '../../components/ui/FormError';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { TerminalCard } from '../../components/ui/TerminalCard';
import { AuthLayout, SoonTag } from './AuthLayout';
import { LiveEventsShowcase } from './BrandShowcase';
import { applyServerError } from './serverErrors';
import { login } from './session';

export function LoginPage() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema), // the same schema the server validates with
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  // On success the store becomes "authenticated" and <GuestOnly> redirects to /app.
  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
    } catch (err) {
      applyServerError(err, setError, ['email', 'password']);
    }
  });

  return (
    <AuthLayout
      headline="Real-time team chat, with an AI that keeps everyone in sync."
      showcase={<LiveEventsShowcase />}
    >
      <TerminalCard title="teamchat login" prompt>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <h1 className="text-[22px] leading-[1.3] font-semibold">Sign in</h1>
            <p className="mt-1 text-muted">Welcome back. Pick up where you left off.</p>
          </div>

          {errors.root?.server && <FormError>{errors.root.server.message}</FormError>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="login-password">password</Label>
              {/* Password reset is not built yet (PLAN Step 7.5). */}
              <span
                aria-disabled="true"
                title="Password reset is coming soon"
                className="flex cursor-not-allowed items-center gap-1.5 text-xs text-muted"
              >
                forgot? <SoonTag />
              </span>
            </div>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button type="submit" enterHint={!isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <Divider label="or" />

          {/* Google sign-in is not built yet (PLAN Step 7.5). */}
          <Button variant="secondary" disabled title="Google sign-in is coming soon">
            Continue with Google <SoonTag />
          </Button>
        </form>
      </TerminalCard>

      <p className="text-center text-muted">
        No account?{' '}
        <Link to="/register" className="font-semibold text-accent-fg hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
