import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

/** Native <select> styled like Input (42px, field background). */
export function Select({ className, ...props }: ComponentProps<'select'> & { id: string }) {
  return (
    <select
      {...props}
      className={cn(
        'h-[42px] w-full cursor-pointer rounded-md border border-border-strong bg-field px-2.5 text-sm text-fg',
        'focus:border-accent focus:ring-[3px] focus:ring-focus-ring focus:outline-none',
        className,
      )}
    />
  );
}
