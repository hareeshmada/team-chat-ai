import { cn } from '../../lib/cn';

export interface LogoProps {
  /** md = 32px (auth brand panel), sm = 28px (loading card, sidebar). */
  size?: 'md' | 'sm';
  /** Show the "teamchat-ai" wordmark next to the mark. */
  wordmark?: boolean;
  className?: string;
}

export function Logo({ size = 'md', wordmark = false, className }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden={wordmark ? 'true' : undefined}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md bg-accent font-mono font-semibold text-on-accent',
          size === 'md' ? 'size-8 text-sm' : 'size-7 text-xs',
        )}
      >
        tc
      </span>
      {wordmark && <span className="font-mono font-semibold">teamchat-ai</span>}
    </span>
  );
}
