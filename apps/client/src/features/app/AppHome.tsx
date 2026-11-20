// TEMPORARY /app page until the real app shell (Day 2). It shows who is signed in, lets you
// log out, and has a "ping /me" button to check that expired access tokens refresh silently.
import { meResponseSchema } from '@teamchat/shared';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { TerminalCard } from '../../components/ui/TerminalCard';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { logout } from '../auth/session';

export function AppHome() {
  const user = useAuthStore((s) => s.user);
  const [ping, setPing] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function pingMe() {
    setPing('…');
    try {
      const { user: me } = await api('/auth/me', {}, meResponseSchema);
      setPing(`200 · ${me.email} · ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setPing(err instanceof ApiError ? `${err.status} · ${err.code}` : 'failed');
    }
  }

  async function onLogout() {
    setLoggingOut(true);
    await logout().catch(() => {}); // the store is cleared either way; RequireAuth redirects
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5">
        <Logo size="sm" wordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="secondary" size="sm" onClick={onLogout} disabled={loggingOut}>
            <LogOut size={14} aria-hidden /> Log out
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <TerminalCard title="teamchat whoami" prompt className="w-full max-w-[400px]">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-[22px] leading-[1.3] font-semibold">Hi, {user?.name}</h1>
              <p className="mt-1 font-mono text-[13px] text-muted">{user?.email}</p>
            </div>
            <p className="text-muted">
              You&apos;re signed in. Channels and the AI assistant arrive on Day 2.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={pingMe}>
                ping /me
              </Button>
              {ping && (
                <span role="status" className="font-mono text-xs text-muted">
                  {ping}
                </span>
              )}
            </div>
          </div>
        </TerminalCard>
      </main>
    </div>
  );
}
