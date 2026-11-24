import type { PublicChannel } from '@teamchat/shared';
import { Lock, Menu, Sparkles, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusDot } from '../../components/ui/StatusDot';
import { cn } from '../../lib/cn';
import { useAssistantStore } from '../../stores/assistant';
import { useConnectionStore } from '../../stores/connection';
import { NotificationBell } from '../notifications/NotificationBell';
import { useShell } from './shellContext';

export function ChannelHeader({ channel }: { channel: PublicChannel }) {
  const { members, online, canInvite, openInvite, openDrawer } = useShell();
  const status = useConnectionStore((s) => s.status);
  const assistantOpen = useAssistantStore((s) => s.open);
  const setAssistantOpen = useAssistantStore((s) => s.setOpen);
  // Public: every workspace member; private: the channel's own member list.
  const memberCount = channel.isPrivate ? channel.memberIds.length : (members?.length ?? 0);
  const onlineCount = members?.filter((m) => online.has(m.userId)).length ?? 0;
  const connectionText =
    status === 'connected' ? 'connected' : status === 'offline' ? 'offline' : 'reconnecting';

  return (
    <header className="flex min-h-14 items-center gap-1 border-b border-border px-1.5 max-md:bg-surface md:flex-wrap md:gap-2.5 md:px-5 md:py-2.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open sidebar"
        onClick={openDrawer}
        className="size-11 text-fg md:hidden"
      >
        <Menu size={20} aria-hidden />
      </Button>

      <div className="flex min-w-0 flex-1 flex-col leading-tight md:flex-none md:flex-row md:items-center md:gap-2.5">
        <h1 className="flex items-center gap-1.5 truncate font-mono text-[15px] font-semibold">
          #{channel.name}
          {channel.isPrivate && (
            <Lock size={13} role="img" aria-label="private" className="text-muted" />
          )}
        </h1>
        {/* Mobile: presence + connection under the name. */}
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted md:hidden">
          <StatusDot status={status === 'connected' ? 'online' : 'connecting'} />
          {onlineCount} online · {connectionText}
        </span>
      </div>

      {channel.description && (
        <span className="hidden min-w-40 flex-1 truncate text-[13px] text-muted md:block">
          {channel.description}
        </span>
      )}
      <span className="ml-auto hidden font-mono text-xs text-muted md:inline">
        {memberCount} {memberCount === 1 ? 'member' : 'members'}
      </span>
      {canInvite && (
        <>
          <Button variant="secondary" size="sm" onClick={openInvite} className="max-md:hidden">
            <UserPlus size={14} aria-hidden /> Invite
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Invite people"
            onClick={openInvite}
            className="size-11 text-fg md:hidden"
          >
            <UserPlus size={20} aria-hidden />
          </Button>
        </>
      )}
      {/* Mobile: a 44px borderless target like the other header icons. */}
      <NotificationBell className="size-11 border-transparent md:size-8 md:border-border-strong" />
      <button
        type="button"
        aria-label="Assistant panel"
        aria-pressed={assistantOpen}
        onClick={() => setAssistantOpen(!assistantOpen)}
        className={cn(
          'inline-flex size-11 cursor-pointer items-center justify-center rounded-md md:size-8 md:border',
          'focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
          assistantOpen
            ? 'text-accent-fg md:border-accent md:bg-accent-soft'
            : 'text-fg hover:bg-surface-2 md:border-border-strong',
        )}
      >
        <Sparkles size={16} aria-hidden className="max-md:size-5" />
      </button>
    </header>
  );
}
