import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type InputProps = ComponentProps<'input'> & {
  /** Required so a <Label htmlFor> and the error message can point at it. */
  id: string;
  /** Error shown below the input and announced via aria-describedby (text, may contain a link). */
  error?: ReactNode;
  /** Monospace text. Defaults to true for email and password fields. */
  mono?: boolean;
  /** Fixed text inside the field before the value, e.g. "#" for channel names. */
  leading?: ReactNode;
};

// React 19: `ref` is a normal prop (inside ComponentProps<'input'>), so react-hook-form's
// register() works with no forwardRef.
export function Input({
  id,
  error,
  mono,
  leading,
  type = 'text',
  className,
  ...props
}: InputProps) {
  const isMono = mono ?? (type === 'email' || type === 'password');
  const errorId = `${id}-error`;
  const describedBy = cn(props['aria-describedby'], error ? errorId : undefined) || undefined;

  const box = cn(
    'h-[42px] w-full rounded-md border bg-field text-fg transition-[border-color,box-shadow]',
    error ? 'border-danger' : 'border-border-strong',
  );
  const text = cn(
    'placeholder:text-muted disabled:cursor-not-allowed disabled:text-subtle read-only:text-muted',
    isMono ? 'font-mono text-[13px]' : 'text-sm',
  );
  const input = (
    <input
      id={id}
      type={type}
      {...props}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={
        leading
          ? cn('h-full min-w-0 flex-1 bg-transparent outline-none', text)
          : cn(
              box,
              'px-3 focus:border-accent focus:ring-[3px] focus:ring-focus-ring focus:outline-none',
              text,
              className,
            )
      }
    />
  );

  return (
    <>
      {leading ? (
        // The wrapper draws the border, so the leading text sits inside the field.
        <div
          className={cn(
            box,
            'flex items-center gap-1 px-3',
            'focus-within:border-accent focus-within:ring-[3px] focus-within:ring-focus-ring',
            className,
          )}
        >
          <span aria-hidden="true" className="font-mono text-muted">
            {leading}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}
