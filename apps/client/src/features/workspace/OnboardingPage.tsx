import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { TerminalCard } from '../../components/ui/TerminalCard';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { useAuthStore } from '../../stores/auth';
import { logout } from '../auth/session';
import { CreateWorkspaceForm } from './CreateWorkspaceForm';

/**
 * /app for a signed-in user with no workspace. If a teammate invites them meanwhile, the
 * socket's workspace:added refetches the list and /app moves them into it automatically.
 */
export function OnboardingPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-bg bg-dot-grid">
      <header className="flex items-center gap-2.5 px-4 py-4 sm:px-6">
        <Logo size="sm" wordmark className="flex-1" />
        <span className="hidden font-mono text-xs text-muted sm:inline">{user?.email}</span>
        <ThemeToggle className="size-8" />
        <Button
          variant="secondary"
          size="sm"
          disabled={loggingOut}
          onClick={() => {
            setLoggingOut(true);
            void logout();
          }}
        >
          <LogOut size={14} aria-hidden className="sm:hidden" />
          <span className="max-sm:sr-only">Log out</span>
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pt-8 pb-16 sm:px-5">
        <div className="flex w-full max-w-[460px] flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-accent-fg">step 1 of 1</span>
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">
              Create your workspace
            </h1>
            <p className="text-muted">
              A workspace is where your team’s channels live. You’ll be its owner.
            </p>
          </div>

          <TerminalCard title="teamchat init" prompt>
            <CreateWorkspaceForm
              id="onboarding"
              autoFocus
              onCreated={(workspace) => navigate(`/app/${workspace.id}`, { replace: true })}
            >
              {({ isSubmitting }) => (
                <Button type="submit" enterHint={!isSubmitting} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create workspace'}
                </Button>
              )}
            </CreateWorkspaceForm>
          </TerminalCard>

          <p className="text-[13px] text-muted">
            Waiting to join a team instead? Ask a teammate to invite{' '}
            <span className="font-mono text-fg">{user?.email}</span>. Your workspace appears here as
            soon as they do.
          </p>
        </div>
      </main>
    </div>
  );
}
