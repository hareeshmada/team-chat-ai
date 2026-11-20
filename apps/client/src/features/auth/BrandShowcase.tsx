// Static, decorative brand-panel content for the auth screens (matches the design references).
import { Badge } from '../../components/ui/Badge';
import { StatusDot } from '../../components/ui/StatusDot';
import { TerminalCard } from '../../components/ui/TerminalCard';

const events = [
  { time: '10:02', kind: 'ws', color: 'text-info', name: 'message:new', meta: '#frontend · priya' },
  { time: '10:03', kind: 'ws', color: 'text-info', name: 'typing:start', meta: 'arjun' },
  {
    time: '10:05',
    kind: 'sse',
    color: 'text-warning',
    name: 'notification',
    meta: 'mention → karthik',
  },
  {
    time: '10:12',
    kind: 'ai',
    color: 'text-accent-fg',
    name: 'stream',
    meta: 'summary #frontend · 41 tok/s',
  },
];

/** Login: a "live events" feed and a bot message. */
export function LiveEventsShowcase() {
  return (
    <div className="flex flex-col gap-4">
      <TerminalCard
        title="live events"
        tone="field"
        padding="sm"
        actions={
          <span className="flex items-center gap-1.5 text-accent-fg">
            <StatusDot status="live" /> connected
          </span>
        }
      >
        <ul className="flex flex-col gap-2 font-mono text-xs">
          {events.map((e, i) => (
            <li key={e.time} className="grid grid-cols-[44px_36px_minmax(0,1fr)] gap-2.5">
              <span className="text-muted">{e.time}</span>
              <span className={e.color}>{e.kind}</span>
              <span>
                {e.name} <span className="text-muted">{e.meta}</span>
                {i === events.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-block h-3.5 w-[7px] animate-blink bg-accent align-text-bottom"
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      </TerminalCard>

      <div className="flex w-[78%] flex-col gap-1.5 self-end rounded-[10px] border border-border bg-field px-3.5 py-3">
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-accent-fg">teamchat-ai</span>
          <Badge>bot</Badge>
        </span>
        <span className="text-[13px]">
          You missed 3 threads in #frontend. PR #42 is waiting for your review.
        </span>
      </div>
    </div>
  );
}

const features = [
  ['Real-time channels.', 'Messages, typing and presence over WebSockets.'],
  ['Live notifications.', 'Mentions and invites pushed instantly.'],
  ['AI assistant.', 'Streaming answers and channel catch-ups.'],
];

/** Register: a "what you get" list. */
export function FeaturesShowcase() {
  return (
    <TerminalCard title="what you get" tone="field" padding="sm" actions={<span>v1.0</span>}>
      <ol className="flex flex-col gap-3 text-[13px]">
        {features.map(([title, text], i) => (
          <li key={title} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
            <span className="font-mono text-accent-fg">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="font-semibold">{title}</span>{' '}
              <span className="text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </TerminalCard>
  );
}
