import { Bell } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { NotificationsDropdown } from './NotificationsDropdown';
import { useUnreadNotificationCount } from './queries';

/** Bell with the unread badge ("9+" cap); opens the notifications dropdown. */
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const unread = useUnreadNotificationCount();

  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative inline-flex cursor-pointer items-center justify-center rounded-md border border-border-strong text-fg hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
          className,
        )}
      >
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg bg-accent px-1 font-mono text-[10px] font-semibold text-on-accent"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && <NotificationsDropdown triggerRef={ref} onClose={() => setOpen(false)} />}
    </div>
  );
}
