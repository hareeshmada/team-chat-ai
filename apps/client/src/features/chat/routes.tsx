import { Navigate, useParams } from 'react-router';
import { useEffect } from 'react';
import { Skeleton } from '../../components/ui/Skeleton';
import { OnboardingPage } from '../workspace/OnboardingPage';
import { getLastWorkspace, setLastWorkspace } from '../workspace/lastWorkspace';
import { AppShell } from './AppShell';
import { ChannelView } from './ChannelView';
import { useChannels, useWorkspaces } from './queries';

/** Skeleton of the shell while the first lists load. */
function ShellSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading workspace" className="flex h-dvh">
      <div className="hidden w-[232px] flex-col gap-4 border-r border-border bg-surface p-4 md:flex">
        <Skeleton className="h-7 w-36" />
        <Skeleton tone="secondary" className="h-3 w-28" />
        <Skeleton tone="secondary" className="h-3 w-24" />
        <Skeleton tone="secondary" className="h-3 w-32" />
      </div>
      <div className="flex-1" />
    </div>
  );
}

function LoadError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-3 text-muted">
      Couldn’t load your workspaces.
      <button
        type="button"
        onClick={retry}
        className="cursor-pointer font-semibold text-accent-fg hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

/** /app: onboarding if you have no workspace, otherwise your last (or first) workspace. */
export function AppIndex() {
  const { data: workspaces, isError, refetch } = useWorkspaces();
  // Error screen only when there is nothing to show: a failed background refetch (e.g. while
  // the server is down) keeps the last good data, and the app stays usable.
  if (!workspaces) return isError ? <LoadError retry={() => void refetch()} /> : <ShellSkeleton />;
  if (workspaces.length === 0) return <OnboardingPage />;
  const last = getLastWorkspace();
  const target = workspaces.find((w) => w.id === last) ?? workspaces[0]!;
  return <Navigate to={`/app/${target.id}`} replace />;
}

/** /app/:workspaceId — the shell; unknown (or no longer yours) → back to /app. */
export function WorkspaceRoute() {
  const { workspaceId = '' } = useParams();
  const { data: workspaces, isError, refetch } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (workspace) setLastWorkspace(workspace.id);
  }, [workspace]);

  if (!workspaces) return isError ? <LoadError retry={() => void refetch()} /> : <ShellSkeleton />;
  if (!workspace) return <Navigate to="/app" replace />;
  return <AppShell key={workspace.id} workspace={workspace} />;
}

/** /app/:workspaceId (index) → its #general (or the first channel). */
export function DefaultChannelRedirect() {
  const { workspaceId = '' } = useParams();
  const { data: channels } = useChannels(workspaceId);
  if (!channels) return null;
  const target = channels.find((c) => c.name === 'general') ?? channels[0];
  return target ? <Navigate to={`/app/${workspaceId}/${target.id}`} replace /> : null;
}

/** /app/:workspaceId/:channelId — unknown (or private and not yours) → the workspace's default. */
export function ChannelRoute() {
  const { workspaceId = '', channelId = '' } = useParams();
  const { data: channels } = useChannels(workspaceId);
  if (!channels) return null;
  const channel = channels.find((c) => c.id === channelId);
  if (!channel) return <Navigate to={`/app/${workspaceId}`} replace />;
  return <ChannelView channel={channel} />;
}
