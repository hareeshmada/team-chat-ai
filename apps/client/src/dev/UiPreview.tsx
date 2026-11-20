// DEV ONLY (/dev/ui): every UI component in every state, in both themes side by side.
// Loaded lazily behind import.meta.env.DEV, so it is not in the production bundle.
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Divider } from '../components/ui/Divider';
import { FormError } from '../components/ui/FormError';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Logo } from '../components/ui/Logo';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusDot, type Status } from '../components/ui/StatusDot';
import { Tag } from '../components/ui/Tag';
import { TerminalCard } from '../components/ui/TerminalCard';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import type { Theme } from '../lib/theme';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[13px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const statuses: Status[] = ['online', 'connecting', 'offline', 'live'];

function Showcase({ theme }: { theme: Theme }) {
  const id = (name: string) => `${theme}-${name}`; // unique ids per column

  return (
    // A nested data-theme re-themes this whole column, independent of <html>.
    <div data-theme={theme} className="flex flex-col gap-8 bg-bg p-6 text-fg">
      <p className="font-mono text-xs text-muted">data-theme=&quot;{theme}&quot;</p>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-2">
          <Button enterHint>Sign in</Button>
          <Button variant="secondary">Continue with Google</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Send ↵</Button>
          <Button size="sm" variant="secondary">
            stop esc
          </Button>
          <Button size="sm" variant="ghost">
            <Plus size={14} aria-hidden /> Add
          </Button>
          <Button size="icon" variant="ghost" aria-label="Add channel">
            <Plus size={16} aria-hidden />
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Label + Input">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('name')}>name</Label>
          <Input id={id('name')} placeholder="Karthik S" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('email')}>email</Label>
          <Input id={id('email')} type="email" defaultValue="karthik@acme.dev" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('email-err')}>email (error)</Label>
          <Input
            id={id('email-err')}
            type="email"
            defaultValue="karthik@acme.dev"
            error="An account with this email already exists."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('disabled')}>password (disabled)</Label>
          <Input id={id('disabled')} type="password" defaultValue="password123" disabled />
        </div>
        <p className="text-xs text-muted">Tab into an input to see the focus ring.</p>
      </Section>

      <Section title="TerminalCard">
        <TerminalCard title="teamchat login" prompt>
          <h1 className="text-[22px] font-semibold">Sign in</h1>
          <p className="mt-1 text-muted">Welcome back. Pick up where you left off.</p>
        </TerminalCard>
        <TerminalCard
          title="live events"
          padding="sm"
          actions={
            <span className="flex items-center gap-1.5 text-accent-fg">
              <StatusDot status="live" /> connected
            </span>
          }
        >
          <div className="grid grid-cols-[44px_36px_1fr] gap-2.5 font-mono text-xs">
            <span className="text-muted">10:02</span>
            <span className="text-info">ws</span>
            <span>message:new</span>
            <span className="text-muted">10:05</span>
            <span className="text-warning">sse</span>
            <span>notification</span>
          </div>
        </TerminalCard>
      </Section>

      <Section title="Tag">
        <div className="flex flex-wrap gap-2">
          <Tag>websockets</Tag>
          <Tag>server-sent events</Tag>
          <Tag>ai streaming</Tag>
        </div>
      </Section>

      <Section title="Logo · Badge">
        <div className="flex flex-wrap items-center gap-4">
          <Logo wordmark />
          <Logo size="sm" />
          <Badge>bot</Badge>
        </div>
      </Section>

      <Section title="Divider · FormError">
        <Divider label="or" />
        <FormError>Invalid email or password</FormError>
      </Section>

      <Section title="Skeleton">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton tone="secondary" className="h-2.5 w-3/4" />
        </div>
      </Section>

      <Section title="StatusDot">
        <div className="flex flex-wrap gap-4 font-mono text-xs text-muted">
          {statuses.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <StatusDot status={s} /> {s}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}

export default function UiPreview() {
  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
        <span className="font-mono text-[13px] font-semibold">/dev/ui · components</span>
        <span className="flex items-center gap-3 font-mono text-xs text-muted">
          page theme <ThemeToggle />
        </span>
      </header>
      <div className="grid md:grid-cols-2">
        <Showcase theme="dark" />
        <Showcase theme="light" />
      </div>
    </div>
  );
}
