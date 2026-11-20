import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export function Tag({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-border-strong px-2 py-[3px] font-mono text-xs text-fg',
        className,
      )}
      {...props}
    />
  );
}
