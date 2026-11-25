import { ChevronsUpDown, Plus, UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { MenuDivider, MenuItem, MenuLabel, PopoverMenu } from '../../components/ui/PopoverMenu';
import { useAuthStore } from '../../stores/auth';
import { useWorkspaces } from '../chat/queries';
import type { ChannelUnread } from '@teamchat/shared';
import { useShell } from '../chat/shellContext';
import { formatCount, useUnread } from '../chat/unread';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

/** Total unread across a workspace's channels: accent "@n" if any mention you, else a count. */
function workspaceBadge(unread: ChannelUnread[] | undefined, workspaceId: string) {
  const here = unread?.filter((c) => c.workspaceId === workspaceId) ?? [];
  const mentions = here.reduce((n, c) => n + c.mentionCount, 0);
  const count = here.reduce((n, c) => n + c.count, 0);
  if (mentions > 0) {
    return (
      <span className="rounded bg-accent px-1.5 font-semibold text-on-accent">
        <span aria-hidden="true">@{formatCount(mentions)}</span>
        <span className="sr-only">, {mentions} mentions</span>
      </span>
    );
  }
  if (count === 0) return undefined;
  return (
    <>
      <span aria-hidden="true">{formatCount(count)}</span>
      <span className="sr-only">, {count} unread</span>
    </>
  );
}

/** The workspace name at the top of the sidebar; opens the switcher menu. */
export function WorkspaceSwitcher() {
  const { workspace, canInvite, openInvite } = useShell();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: unread } = useUnread();
  const email = useAuthStore((s) => s.user?.email);
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        <Avatar name={workspace.name} tone="accent" />
        <span className="min-w-0 flex-1 truncate font-semibold">{workspace.name}</span>
        <ChevronsUpDown size={14} aria-hidden className="text-muted" />
      </button>

      {open && (
        <PopoverMenu
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
          label="Workspaces"
          className="absolute top-full left-0 mt-1"
        >
          <MenuLabel>workspaces</MenuLabel>
          {workspaces.map((ws) => (
            <MenuItem
              key={ws.id}
              current={ws.id === workspace.id}
              icon={
                <Avatar
                  name={ws.name}
                  size="sm"
                  tone={ws.id === workspace.id ? 'accent' : 'neutral'}
                />
              }
              meta={workspaceBadge(unread, ws.id)}
              onClick={choose(() => navigate(`/app/${ws.id}`))}
            >
              {ws.name}
            </MenuItem>
          ))}
          <MenuDivider />
          <MenuItem
            kind="action"
            icon={<Plus size={15} aria-hidden className="text-muted" />}
            onClick={choose(() => setCreating(true))}
          >
            Create workspace
          </MenuItem>
          {canInvite && (
            <MenuItem
              kind="action"
              icon={<UserPlus size={15} aria-hidden className="text-muted" />}
              onClick={choose(openInvite)}
            >
              Invite people to {workspace.name}
            </MenuItem>
          )}
          <MenuDivider />
          <span className="truncate px-2.5 pt-1 pb-1.5 font-mono text-[11px] text-muted">
            signed in as {email}
          </span>
        </PopoverMenu>
      )}

      {creating && <CreateWorkspaceModal onClose={() => setCreating(false)} />}
    </div>
  );
}
