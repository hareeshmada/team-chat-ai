import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@teamchat/shared';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
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

export function RegisterPage() {
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser(values);
    } catch (err) {
      applyServerError(err, setError, ['name', 'email', 'password'], { EMAIL_TAKEN: 'email' });
    }
  });

  const emailError =
    errors.email?.type === 'EMAIL_TAKEN' ? (
      <>
        An account with this email already exists.{' '}
        <Link to="/login" className="underline">
          Sign in instead
        </Link>
      </>
    ) : (
      errors.email?.message
    );

  return (
    <AuthLayout headline="Set up your team in under a minute." showcase={<FeaturesShowcase />}>
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
              error={emailError}
              {...register('email')}
            />
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
        <Link to="/login" className="font-semibold text-accent-fg hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
