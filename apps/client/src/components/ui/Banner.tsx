import { Check, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BannerTone = 'warning' | 'success' | 'danger';

const tones: Record<BannerTone, string> = {
  warning: 'bg-warning/10 border-warning/35',
  success: 'bg-success/10 border-success/35',
  danger: 'bg-danger/10 border-danger/35',
};

export interface BannerProps {
  tone: BannerTone;
  /** Mono meta text on the right, e.g. "attempt 2". */
  meta?: ReactNode;
  /** A button on the right, e.g. "Retry now". */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Full-width connection banner. warning/success are polite status; danger is an alert. */
export function Banner({ tone, meta, action, className, children }: BannerProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-2.5 rounded-md border py-2.5 text-[13px]',
        action ? 'pr-2 pl-3.5' : 'px-3.5',
        tones[tone],
        className,
      )}
    >
      {tone === 'warning' && (
        <LoaderCircle
          size={14}
          aria-hidden
          className="shrink-0 text-warning motion-safe:animate-spin"
        />
      )}
      {tone === 'success' && <Check size={14} aria-hidden className="shrink-0 text-success" />}
      <span className="flex-1">{children}</span>
      {meta && (
        <span
          className={cn(
            'font-mono text-[11px]',
            tone === 'warning' ? 'text-warning' : 'text-muted',
          )}
        >
          {meta}
        </span>
      )}
      {action}
    </div>
  );
}
