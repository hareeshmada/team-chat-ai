// DEV ONLY (/dev/ui): every UI component in every state, in both themes side by side.
// Loaded lazily behind import.meta.env.DEV, so it is not in the production bundle.
import { Plus, UserPlus } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../components/ui/Avatar';
import { Banner } from '../components/ui/Banner';
import { CheckboxCard } from '../components/ui/CheckboxCard';
import { Modal } from '../components/ui/Modal';
import { NewMessagesPill } from '../components/ui/NewMessagesPill';
import { MenuDivider, MenuItem, MenuLabel, PopoverMenu } from '../components/ui/PopoverMenu';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { MessageRow } from '../features/chat/MessageRow';
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

      <Section title="Input leading · Textarea · Select · CheckboxCard">
        <Input id={id('leading')} leading="#" mono placeholder="design-reviews" />
        <Textarea id={id('textarea')} rows={2} placeholder="What is this channel about?" />
        <Select id={id('select')} defaultValue="member">
          <option value="member">member</option>
          <option value="admin">admin</option>
        </Select>
        <CheckboxCard
          title="Make private"
          description="Only invited members can see and join this channel."
        />
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-2">
          <Avatar name="acme-studio" tone="accent" />
          <Avatar name="side-project" />
          <Avatar name="Karthik S" tone="user" className="text-author-3" />
          <Avatar name="acme-studio" size="sm" tone="accent" />
          <Avatar name="Karthik S" size="lg" tone="user" className="text-author-2" />
        </div>
      </Section>

      <Section title="Banner">
        <Banner tone="warning" meta="attempt 2">
          Connection lost. Reconnecting…
        </Banner>
        <Banner tone="success">Back online. 3 missed messages loaded.</Banner>
        <Banner
          tone="danger"
          action={
            <Button size="sm" variant="secondary">
              Retry now
            </Button>
          }
        >
          Can’t reach the server.
        </Banner>
      </Section>

      <Section title="MessageRow states">
        <div className="flex flex-col gap-1 rounded-[10px] border border-border p-2.5">
          <MessageRow
            createdAt={new Date().toISOString()}
            body="Delivered message (hover: sent)."
            author={{ name: 'priya', colorClass: 'text-author-1' }}
            isOwn
          />
          <MessageRow
            createdAt={new Date().toISOString()}
            body="Compact follow-up from the same author."
          />
          <MessageRow
            createdAt={new Date().toISOString()}
            body="Sending message, waiting for ack."
            state="sending"
          />
          <MessageRow
            createdAt={new Date().toISOString()}
            body="Failed message keeps its text."
            state="failed"
          />
        </div>
      </Section>

      <Section title="NewMessagesPill">
        <div>
          <NewMessagesPill count={3} onClick={() => {}} />
        </div>
      </Section>

      <Section title="Modal · PopoverMenu">
        <OverlayDemos />
      </Section>
    </div>
  );
}

function OverlayDemos() {
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setModal(true)}>
        Open modal
      </Button>
      <Button
        ref={trigger}
        size="sm"
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
      >
        Open menu
      </Button>
      {menu && (
        <PopoverMenu
          triggerRef={trigger}
          onClose={() => setMenu(false)}
          label="Demo"
          className="absolute top-full left-0 mt-1"
        >
          <MenuLabel>workspaces</MenuLabel>
          <MenuItem current icon={<Avatar name="acme-studio" size="sm" tone="accent" />}>
            acme-studio
          </MenuItem>
          <MenuItem current={false} icon={<Avatar name="side-project" size="sm" />}>
            side-project
          </MenuItem>
          <MenuDivider />
          <MenuItem kind="action" icon={<UserPlus size={15} aria-hidden className="text-muted" />}>
            Invite people
          </MenuItem>
        </PopoverMenu>
      )}
      {modal && (
        <Modal
          title="Create a channel"
          onClose={() => setModal(false)}
          footer={
            <>
              <Button variant="secondary" className="h-10" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button enterHint className="h-10">
                Create channel
              </Button>
            </>
          }
        >
          <Input id="demo-modal-name" leading="#" mono placeholder="design-reviews" />
        </Modal>
      )}
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
