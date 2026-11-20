import { cn } from '../../lib/cn';

export interface SkeletonProps {
  /** primary = titles/names (`skeleton`), secondary = body lines (`skeleton-2`). */
  tone?: 'primary' | 'secondary';
  /** Size and layout only, e.g. "h-3 w-28". */
  className?: string;
}

/** Decorative placeholder bar. Mark the loading region with aria-busy, not each bar. */
export function Skeleton({ tone = 'primary', className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block rounded-[3px]',
        tone === 'primary' ? 'bg-skeleton' : 'bg-skeleton-2',
        className,
      )}
    />
  );
}
