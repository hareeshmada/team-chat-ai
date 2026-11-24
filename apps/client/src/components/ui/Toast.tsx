import { X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface ToastProps {
  /** 28px square on the left (e.g. "@"). */
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Buttons under the text (e.g. "View"). */
  actions?: ReactNode;
  onDismiss: () => void;
  /** Auto-dismiss after this long; paused while hovered or focused. Omit to stay. */
  durationMs?: number;
}

/**
 * One toast card (DESIGN §8 Toast). The countdown is a CSS animation on the progress bar:
 * `animationend` dismisses, and pausing the animation on hover/focus pauses the timer as well.
 * Under reduced motion the bar is hidden but the (invisible) countdown still runs.
 */
export function Toast({ icon, title, body, actions, onDismiss, durationMs }: ToastProps) {
  return (
    <div className="group/toast pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-[10px] border border-border-strong bg-surface text-fg shadow-float">
      <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-2.5 py-3 pr-2 pl-3.5">
        <span
          aria-hidden="true"
          className="inline-flex size-7 items-center justify-center rounded-md bg-accent-soft font-mono font-semibold text-accent-fg"
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px]">{title}</span>
          {body && <span className="truncate text-[13px] text-muted">{body}</span>}
          {actions && <span className="mt-1.5 flex gap-2">{actions}</span>}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {durationMs !== undefined && (
        <div aria-hidden="true" className="h-0.5 bg-border">
          <div
            style={{ '--toast-duration': `${durationMs}ms` } as CSSProperties}
            onAnimationEnd={onDismiss}
            className={cn(
              'animate-toast-countdown h-0.5 bg-accent motion-reduce:invisible',
              'group-focus-within/toast:[animation-play-state:paused] group-hover/toast:[animation-play-state:paused]',
            )}
          />
        </div>
      )}
    </div>
  );
}
