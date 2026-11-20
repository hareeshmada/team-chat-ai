import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type BaseProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  /** Shows a trailing ↵ hint (submit buttons). */
  enterHint?: boolean;
};

// md = forms (44px), sm = toolbars (32px), icon = square icon-only button (36px).
// An icon-only button has no visible text, so TypeScript requires an aria-label for it.
export type ButtonProps = BaseProps &
  ({ size?: 'md' | 'sm' } | { size: 'icon'; 'aria-label': string });

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent font-semibold hover:bg-accent-hover',
  secondary: 'border border-border-strong text-fg font-medium hover:bg-surface-2',
  ghost: 'text-muted font-medium hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-on-danger font-semibold hover:opacity-90',
};

const sizes = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-8 px-3 text-[13px]',
  icon: 'size-9',
};

export function Button({
  variant = 'primary',
  size = 'md',
  enterHint = false,
  type = 'button', // never submit a form by accident
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
      {enterHint && <span aria-hidden="true">↵</span>}
    </button>
  );
}
