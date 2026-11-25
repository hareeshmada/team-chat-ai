import { ChevronsUpDown, LogOut } from 'lucide-react';
import { useRef, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { MenuDivider, MenuItem, PopoverMenu } from '../../components/ui/PopoverMenu';
import { UsageMeter } from '../../components/ui/UsageMeter';
import { cn } from '../../lib/cn';
import { useTheme, type Theme } from '../../lib/theme';
import { useAuthStore } from '../../stores/auth';
import { compactTokens, formatTokens, resetClock, resetIn, useAiUsage } from '../assistant/usage';
import { logout } from '../auth/session';
import { authorColor } from './format';

/**
 * The user row at the bottom of the sidebar (Step 4.4): name + "ai 12.4k / 50k". Opens the
 * account menu upward: who you are, AI usage today (meter, reset time), theme, log out.
 */
export function UserMenu({ drawer = false }: { drawer?: boolean }) {
  const me = useAuthStore((s) => s.user);
  const { data: usage } = useAiUsage();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!me) return null;

  const close = () => setOpen(false);
  const warn = usage && !usage.degraded && usage.used >= usage.limit * 0.8;

  return (
    <div className={cn('relative mt-auto border-t border-border', !drawer && '-mx-1 pt-1.5')}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 rounded-md text-left hover:bg-surface-2',
          'focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
          drawer ? 'mt-2.5 min-h-11 p-1.5' : 'm-0 p-2',
        )}
      >
        <Avatar
          name={me.name}
          tone="user"
          size={drawer ? 'lg' : 'md'}
          className={authorColor(me.id)}
        />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold">{me.name}</span>
          <span className={cn('font-mono text-[11px]', warn ? 'text-warning' : 'text-muted')}>
            {usage
              ? usage.degraded
                ? 'ai usage unavailable'
                : `ai ${compactTokens(usage.used)} / ${compactTokens(usage.limit)}`
              : 'ai …'}
          </span>
        </span>
        <ChevronsUpDown size={14} aria-hidden className="text-muted" />
      </button>

      {open && (
        <PopoverMenu
          triggerRef={triggerRef}
          onClose={close}
          label="Account"
          className="absolute bottom-full left-0 mb-1.5"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar name={me.name} tone="user" size="lg" className={authorColor(me.id)} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">{me.name}</span>
              <span className="truncate font-mono text-[11px] text-muted">{me.email}</span>
            </span>
          </div>
          <MenuDivider />

          <div className="flex flex-col gap-1.5 px-2.5 py-2">
            <span className="flex justify-between gap-2 text-[13px]">
              <span>AI usage today</span>
              <span className={cn('font-mono text-xs', warn ? 'text-warning' : 'text-muted')}>
                {usage && !usage.degraded
                  ? `${formatTokens(usage.used)} / ${formatTokens(usage.limit)}`
                  : '–'}
              </span>
            </span>
            {usage && !usage.degraded && <UsageMeter used={usage.used} limit={usage.limit} />}
            <span className="font-mono text-[11px] text-muted">
              {!usage
                ? 'loading…'
                : usage.degraded
                  ? 'usage tracking is unavailable right now'
                  : `resets at ${resetClock(usage.resetAt)} · ${resetIn(usage.resetAt)}`}
            </span>
          </div>
          <MenuDivider />

          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span id="theme-label" className="flex-1 text-[13px]">
              Theme
            </span>
            <div
              role="group"
              aria-labelledby="theme-label"
              className="flex overflow-hidden rounded-md border border-border-strong"
            >
              {(['dark', 'light'] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === t}
                  tabIndex={-1}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'h-[30px] cursor-pointer px-2.5 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:ring-inset',
                    theme === t ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <MenuDivider />

          <MenuItem
            kind="action"
            icon={<LogOut size={15} aria-hidden className="text-muted" />}
            onClick={() => {
              close();
              void logout();
            }}
          >
            Log out
          </MenuItem>
        </PopoverMenu>
      )}
    </div>
  );
}
