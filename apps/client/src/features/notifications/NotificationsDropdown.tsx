import { BellOff, Info, LoaderCircle, UserPlus } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { Button } from '../../components/ui/Button';
import { NotificationItem } from '../../components/ui/NotificationItem';
import { StatusDot } from '../../components/ui/StatusDot';
import { useDismiss } from '../../components/ui/useDismiss';
import { useNotificationStreamStore } from '../../stores/notificationStream';
import { describeNotification, notificationTime } from './describe';
import { DesktopNotificationsToggle } from './DesktopNotificationsToggle';
import { NotificationTitle } from './NotificationTitle';
import { markNotificationsRead, useNotifications } from './queries';
import { useOpenNotification } from './useOpenNotification';

const ICONS = {
  mention: '@',
  invite: <UserPlus size={14} />,
  info: <Info size={14} />,
} as const;

/**
 * The list under the bell (DESIGN §8 NotificationsDropdown, reference day3-notifications.html).
 * A non-modal dialog: Esc / outside click close and focus returns to the bell; ↑/↓ move.
 */
export function NotificationsDropdown({
  triggerRef,
  onClose,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, triggerRef, onClose);
  const query = useNotifications();
  const open = useOpenNotification();
  const stream = useNotificationStreamStore();
  const notifications = query.data?.pages.flatMap((p) => p.notifications) ?? [];
  const unread = query.data?.pages[0]?.unreadCount ?? 0;

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('[data-notification-item]');
    (first ?? ref.current)?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      triggerRef.current?.focus();
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [
      ...(ref.current?.querySelectorAll<HTMLElement>('[data-notification-item]') ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
    items[(next + items.length) % items.length]?.focus();
    e.preventDefault();
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="absolute top-full right-0 z-40 mt-2 flex max-h-[min(520px,calc(100dvh-96px))] w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[10px] border border-border-strong bg-surface text-fg shadow-float outline-none"
    >
      <header className="flex items-center gap-2 border-b border-border py-2.5 pr-2.5 pl-4">
        <h3 className="flex-1 font-mono text-[13px] font-semibold">
          notifications{' '}
          {unread > 0 && <span className="text-accent-fg">· {unread > 9 ? '9+' : unread} new</span>}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          disabled={unread === 0}
          onClick={() => void markNotificationsRead({ all: true })}
        >
          Mark all read
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {query.isPending ? (
          <div role="status" className="flex items-center gap-2 p-4 text-[13px] text-muted">
            <LoaderCircle size={14} aria-hidden className="motion-safe:animate-spin" /> loading
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
            <BellOff size={20} aria-hidden className="text-muted" />
            <span className="text-sm font-semibold">You’re all caught up</span>
            <span className="text-[13px] text-muted">Mentions and invites will show up here.</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {notifications.map((n) => {
              const view = describeNotification(n);
              return (
                <NotificationItem
                  key={n.id}
                  icon={ICONS[view.kind]}
                  tone={view.kind === 'mention' ? 'accent' : 'neutral'}
                  title={<NotificationTitle view={view} />}
                  body={view.body}
                  time={notificationTime(n.createdAt)}
                  unread={!n.readAt}
                  onSelect={() => {
                    onClose();
                    open(n);
                  }}
                />
              );
            })}
          </ul>
        )}
      </div>

      <DesktopNotificationsToggle />
      <footer className="flex items-center gap-2 border-t border-border py-2 pr-2.5 pl-4 font-mono text-[11px] text-muted">
        <span className="inline-flex flex-1 items-center gap-1.5" role="status">
          <StatusDot status={stream.status === 'connected' ? 'online' : 'connecting'} />
          {stream.status === 'connected'
            ? 'stream connected'
            : stream.attempt > 0
              ? `stream reconnecting · will replay missed · attempt ${stream.attempt}`
              : 'stream connecting'}
        </span>
        {query.hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Load older
          </Button>
        )}
      </footer>
    </div>
  );
}
