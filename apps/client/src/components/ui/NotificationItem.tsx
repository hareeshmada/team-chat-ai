import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface NotificationItemProps {
  /** Content of the 28px square ("@" or an icon). */
  icon: ReactNode;
  /** Accent square for mentions; neutral for invites/system. */
  tone?: 'accent' | 'neutral';
  title: ReactNode;
  body?: ReactNode;
  time: string;
  unread: boolean;
  onSelect: () => void;
}

/** One row of the notifications dropdown (DESIGN §8 NotificationsDropdown). */
export function NotificationItem({
  icon,
  tone = 'accent',
  title,
  body,
  time,
  unread,
  onSelect,
}: NotificationItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        data-notification-item
        className={cn(
          'grid w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)_auto] gap-2.5 rounded-md p-2.5 text-left',
          'hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
          unread ? 'bg-surface-2 text-fg' : 'text-muted',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-md font-mono font-semibold',
            tone === 'accent' ? 'bg-accent-soft text-accent-fg' : 'bg-surface-2 text-muted',
          )}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px]">{title}</span>
          {body && <span className="truncate text-[13px] text-muted">{body}</span>}
        </span>
        <span className="flex flex-col items-end gap-1.5 font-mono text-[11px] text-muted">
          {time}
          {unread && (
            <span role="img" aria-label="unread" className="size-1.5 rounded-full bg-accent" />
          )}
        </span>
      </button>
    </li>
  );
}
