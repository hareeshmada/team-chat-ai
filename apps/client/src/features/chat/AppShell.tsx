import { ROLE_RANK, type PublicWorkspace } from '@teamchat/shared';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { Drawer } from '../../components/ui/Drawer';
import { InviteMemberModal } from '../workspace/InviteMemberModal';
import { CreateChannelModal } from './CreateChannelModal';
import { usePresence } from './hooks';
import { useMembers } from './queries';
import { ShellContext, type ShellContextValue } from './shellContext';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

/**
 * 232px sidebar · main · 28px status bar. Below 768px the sidebar is a slide-over drawer and
 * the status bar is hidden (the mobile header shows the connection instead).
 */
export function AppShell({ workspace }: { workspace: PublicWorkspace }) {
  const { data: members } = useMembers(workspace.id);
  const online = usePresence(workspace.id);
  const [modal, setModal] = useState<'invite' | 'channel' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const value: ShellContextValue = useMemo(
    () => ({
      workspace,
      members,
      online,
      canInvite: ROLE_RANK[workspace.role] >= ROLE_RANK.admin,
      openInvite: () => setModal('invite'),
      openCreateChannel: () => {
        setDrawerOpen(false);
        setModal('channel');
      },
      openDrawer: () => setDrawerOpen(true),
    }),
    [workspace, members, online],
  );

  return (
    <ShellContext.Provider value={value}>
      <div className="flex h-dvh flex-col">
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[232px] shrink-0 border-r border-border md:block">
            <Sidebar />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">
            <Outlet />
          </main>
        </div>
        <div className="max-md:hidden">
          <StatusBar />
        </div>
      </div>

      {drawerOpen && (
        <Drawer label="Sidebar" onClose={() => setDrawerOpen(false)}>
          <Sidebar onClose={() => setDrawerOpen(false)} />
        </Drawer>
      )}
      {modal === 'invite' && (
        <InviteMemberModal workspace={workspace} onClose={() => setModal(null)} />
      )}
      {modal === 'channel' && <CreateChannelModal onClose={() => setModal(null)} />}
    </ShellContext.Provider>
  );
}
