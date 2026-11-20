import { Logo } from '../../components/ui/Logo';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusDot } from '../../components/ui/StatusDot';
import { cn } from '../../lib/cn';
import { useAuthStore, type RestoreStep } from '../../stores/auth';

const STEPS: { id: RestoreStep; label: string }[] = [
  { id: 'refresh', label: 'refresh token' },
  { id: 'profile', label: 'loading profile' },
];
// "connecting to workspace" joins this list once sockets exist (Day 2).

const PROGRESS: Record<RestoreStep, string> = { refresh: 'w-1/4', profile: 'w-2/3' };

/** Session restore (screens/loading-dark.html): skeleton app shell + floating checklist card. */
export function LoadingScreen() {
  const current = useAuthStore((s) => s.restoreStep);
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div aria-busy="true" className="relative flex min-h-screen flex-col">
      <SkeletonShell />

      <div
        role="status"
        className="absolute top-1/2 left-1/2 flex w-[320px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-[10px] border border-border-strong bg-surface p-5 shadow-float"
      >
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="font-semibold">Restoring your session</span>
        </div>
        <ul className="flex flex-col gap-1.5 font-mono text-xs">
          {STEPS.map((step, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending';
            return (
              <li
                key={step.id}
                className={cn(
                  state === 'done' && 'text-muted',
                  state === 'current' && 'text-fg',
                  state === 'pending' && 'text-subtle',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-block w-5',
                    state === 'done' && 'text-success',
                    state === 'current' && 'text-accent',
                  )}
                >
                  {state === 'done' ? '✓' : state === 'current' ? '›' : '·'}
                </span>
                <span className="sr-only">{state}: </span>
                {step.label}
                {state === 'current' && (
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-block h-[13px] w-[7px] animate-blink bg-accent align-text-bottom"
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div className="h-[3px] rounded-sm bg-border">
          <div
            className={cn(
              'h-[3px] rounded-sm bg-accent transition-[width] duration-300',
              PROGRESS[current],
            )}
          />
        </div>
      </div>

      <footer
        aria-hidden="true"
        className="flex h-7 items-center gap-4 border-t border-border bg-surface px-3.5 font-mono text-[11px] text-muted"
      >
        <span className="flex items-center gap-1.5">
          <StatusDot status="connecting" /> connecting…
        </span>
      </footer>
    </div>
  );
}

function MessageSkeleton({ name, lines }: { name: string; lines: string[] }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
      <Skeleton tone="secondary" className="h-2.5" />
      <div className="flex flex-col gap-2">
        <Skeleton className={cn('h-2.5', name)} />
        {lines.map((w) => (
          <Skeleton key={w} tone="secondary" className={cn('h-2.5', w)} />
        ))}
      </div>
    </div>
  );
}

function SkeletonShell() {
  return (
    <div aria-hidden="true" className="flex flex-1">
      <div className="hidden w-[232px] shrink-0 flex-col gap-3.5 border-r border-border bg-surface px-4 py-5 md:flex">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-[34px] rounded-md" />
        <Skeleton className="mt-2 h-2.5 w-[70px]" />
        <Skeleton className="h-3 w-[120px]" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-[132px]" />
        <Skeleton className="h-3 w-[88px]" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-[57px] items-center gap-3 border-b border-border px-5">
          <Skeleton className="h-3.5 w-[100px]" />
          <Skeleton tone="secondary" className="h-2.5 w-[220px]" />
        </div>
        <div className="flex flex-col gap-[22px] px-7 py-6">
          <MessageSkeleton name="w-[70px]" lines={['w-[72%]']} />
          <MessageSkeleton name="w-[60px]" lines={['w-[48%]']} />
          <MessageSkeleton name="w-20" lines={['w-[84%]', 'w-[40%]']} />
        </div>
      </div>
    </div>
  );
}
