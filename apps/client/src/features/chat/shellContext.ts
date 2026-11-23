import type { PublicWorkspace, WorkspaceMember } from '@teamchat/shared';
import { createContext, useContext } from 'react';

/** What every screen inside the app shell needs about the open workspace. */
export interface ShellContextValue {
  workspace: PublicWorkspace;
  members: WorkspaceMember[] | undefined;
  online: Set<string>;
  canInvite: boolean;
  openInvite: () => void;
  openCreateChannel: () => void;
  openDrawer: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside <AppShell>');
  return value;
}
