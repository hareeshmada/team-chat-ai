import { cn } from '../../lib/cn';

export type Status = 'online' | 'connecting' | 'offline' | 'live';

const styles: Record<Status, string> = {
  online: 'bg-success', // online, connected, completed
  connecting: 'bg-warning',
  offline: 'border border-subtle', // hollow ring
  live: 'bg-accent', // live stream / "connected" in the event feed
};

/**
 * Decorative only (aria-hidden): always put text next to it ("ws connected"),
 * because color alone must never carry meaning.
 */
export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-1.5 shrink-0 rounded-full', styles[status], className)}
    />
  );
}
