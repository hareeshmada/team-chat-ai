import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type TextareaProps = ComponentProps<'textarea'> & {
  id: string;
  error?: ReactNode;
};

/** Multi-line twin of Input: same field background, border, focus ring and error handling. */
export function Textarea({ id, error, className, ...props }: TextareaProps) {
  const errorId = `${id}-error`;
  const describedBy = cn(props['aria-describedby'], error ? errorId : undefined) || undefined;
  return (
    <>
      <textarea
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full resize-y rounded-md border bg-field px-3 py-2.5 text-sm text-fg',
          'placeholder:text-muted focus:border-accent focus:ring-[3px] focus:ring-focus-ring focus:outline-none',
          error ? 'border-danger' : 'border-border-strong',
          className,
        )}
      />
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}
