import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TerminalCardProps {
  /** Header text, e.g. "teamchat login" or "live events". */
  title: ReactNode;
  /** Prefix the title with an accent `$` prompt. */
  prompt?: boolean;
  /** Right side of the header, e.g. a status. */
  actions?: ReactNode;
  /** md = 24px body padding (forms), sm = 14px (feeds). */
  padding?: 'md' | 'sm';
  className?: string;
  children: ReactNode;
}

export function TerminalCard({
  title,
  prompt = false,
  actions,
  padding = 'md',
  className,
  children,
}: TerminalCardProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-[10px] border border-border bg-surface', className)}
    >
      <div className="flex h-[34px] items-center justify-between gap-2 border-b border-border px-3.5 font-mono text-xs text-muted">
        <span className="flex items-center gap-1.5">
          {prompt && (
            <span className="text-accent-fg" aria-hidden="true">
              $
            </span>
          )}
          {title}
        </span>
        {actions}
      </div>
      <div className={padding === 'md' ? 'p-6' : 'p-3.5'}>{children}</div>
    </div>
  );
}
