import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type InputProps = ComponentProps<'input'> & {
  /** Required so a <Label htmlFor> and the error message can point at it. */
  id: string;
  /** Error shown below the input and announced via aria-describedby (text, may contain a link). */
  error?: ReactNode;
  /** Monospace text. Defaults to true for email and password fields. */
  mono?: boolean;
};

// React 19: `ref` is a normal prop (inside ComponentProps<'input'>), so react-hook-form's
// register() works with no forwardRef.
export function Input({ id, error, mono, type = 'text', className, ...props }: InputProps) {
  const isMono = mono ?? (type === 'email' || type === 'password');
  const errorId = `${id}-error`;
  const describedBy = cn(props['aria-describedby'], error ? errorId : undefined) || undefined;

  return (
    <>
      <input
        id={id}
        type={type}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-[42px] w-full rounded-md border bg-field px-3 text-fg transition-[border-color,box-shadow]',
          'placeholder:text-muted',
          'focus:border-accent focus:ring-[3px] focus:ring-focus-ring focus:outline-none',
          'disabled:cursor-not-allowed disabled:text-subtle',
          error ? 'border-danger' : 'border-border-strong',
          isMono ? 'font-mono text-[13px]' : 'text-sm',
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
