import { Lock, Plus, X } from 'lucide-react';
import { NavLink } from 'react-router';
import { Button } from '../../components/ui/Button';
import { StatusDot } from '../../components/ui/StatusDot';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth';
import { useConnectionStore } from '../../stores/connection';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';
import { useChannels } from './queries';
import { useShell } from './shellContext';
import { formatCount, useIsWatching, useUnreadByChannel } from './unread';
import { UserMenu } from './UserMenu';

const groupLabel = 'text-[11px] font-semibold tracking-[0.08em] text-muted uppercase';

/** Desktop sidebar and the mobile drawer's content (onClose = drawer mode: 44px targets). */
export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { workspace, members, online, openCreateChannel } = useShell();
  const { data: channels } = useChannels(workspace.id);
  const unread = useUnreadByChannel();
  // The open channel shows its badge only while you're NOT watching (window unfocused/hidden):
  // messages arriving then stay unread until you come back.
  const watching = useIsWatching();
  const me = useAuthStore((s) => s.user);
  const connection = useConnectionStore((s) => s.status);
  const drawer = Boolean(onClose);

  // Online first, then by name; you are always "online" while your socket is connected.
  const sortedMembers = [...(members ?? [])].sort(
    (a, b) =>
      Number(online.has(b.userId)) - Number(online.has(a.userId)) || a.name.localeCompare(b.name),
  );
  const onlineCount = members?.filter((m) => online.has(m.userId)).length ?? 0;

  return (
    <nav
      aria-label="Workspace"
      className={cn(
        'flex h-full flex-col bg-surface',
        drawer ? 'gap-4 p-2.5 pb-3.5' : 'gap-[18px] px-3 py-3.5',
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <WorkspaceSwitcher />
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close sidebar"
            onClick={onClose}
            className="size-11"
          >
            <X size={18} aria-hidden />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-px">
        <div
          className={cn('flex items-center justify-between', drawer ? 'pl-2' : 'pr-1 pb-1.5 pl-2')}
        >
          <span className={groupLabel}>Channels</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Create channel"
            onClick={openCreateChannel}
            className={drawer ? 'size-11' : 'size-8'}
          >
            <Plus size={drawer ? 18 : 16} aria-hidden />
          </Button>
        </div>
        <ul className="flex flex-col gap-px overflow-y-auto">
          {channels?.map((c) => {
            const u = unread.get(c.id);
            const hasUnread = (u?.count ?? 0) > 0;
            return (
              <li key={c.id}>
                <NavLink
                  to={`/app/${workspace.id}/${c.id}`}
                  onClick={onClose}
                  className={({ isActive }: { isActive: boolean }) =>
                    cn(
                      'flex items-center gap-1.5 rounded-md px-2 font-mono',
                      'focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
                      drawer ? 'h-11 px-2.5 text-sm' : 'h-8 text-[13px]',
                      isActive
                        ? 'bg-surface-2 text-fg shadow-[inset_2px_0_0_var(--accent)]'
                        : hasUnread
                          ? 'font-semibold text-fg hover:bg-surface-2'
                          : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )
                  }
                >
                  {({ isActive }: { isActive: boolean }) => {
                    const showBadge = !isActive || !watching;
                    return (
                      <>
                        <span className="truncate">#{c.name}</span>
                        {c.isPrivate && (
                          <Lock size={12} role="img" aria-label="private" className="shrink-0" />
                        )}
                        {/* The open channel is being read: no badge on it while you're watching. */}
                        {showBadge && u && u.mentionCount > 0 ? (
                          <span className="ml-auto rounded bg-accent px-1.5 text-[11px] font-semibold text-on-accent">
                            <span aria-hidden="true">@{formatCount(u.mentionCount)}</span>
                            <span className="sr-only">
                              , {u.mentionCount} {u.mentionCount === 1 ? 'mention' : 'mentions'}
                            </span>
                          </span>
                        ) : showBadge && u && hasUnread ? (
                          <span className="ml-auto text-[11px] font-normal text-muted">
                            <span aria-hidden="true">{formatCount(u.count)}</span>
                            <span className="sr-only">, {u.count} unread</span>
                          </span>
                        ) : null}
                      </>
                    );
                  }}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-h-0 flex-col gap-px">
        <span className={cn(groupLabel, 'px-2 pb-1.5')}>Members · {onlineCount} online</span>
        <ul className="flex flex-col gap-px overflow-y-auto">
          {sortedMembers.map((m) => {
            const isMe = m.userId === me?.id;
            // Your own dot follows your socket: "connecting" (yellow) while it reconnects.
            const isOnline = isMe ? connection === 'connected' : online.has(m.userId);
            const dot = isMe && !isOnline ? 'connecting' : isOnline ? 'online' : 'offline';
            return (
              <li
                key={m.userId}
                className={cn(
                  'flex items-center gap-2 px-2',
                  drawer ? 'h-9 gap-2.5 px-2.5 text-sm' : 'h-[30px] text-[13px]',
                  dot === 'offline' && 'text-muted',
                )}
              >
                <StatusDot status={dot} className="size-[7px]" />
                <span className="truncate">{m.name}</span>
                {isMe && <span className="text-muted">(you)</span>}
                <span className="sr-only">{dot}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <UserMenu drawer={drawer} />
    </nav>
  );
}
