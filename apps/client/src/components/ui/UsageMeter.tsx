import { cn } from '../../lib/cn';

const SEGMENTS = 20;

/**
 * A 20-block meter (AI usage). Accent normally, warning from 80% (and at 100%). Exposed as an
 * ARIA meter: screen readers hear e.g. "AI usage today, 12,400 of 50,000 tokens".
 */
export function UsageMeter({
  used,
  limit,
  label = 'AI usage today',
  className,
}: {
  used: number;
  limit: number;
  label?: string;
  className?: string;
}) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  const filled = Math.round(ratio * SEGMENTS);
  const warn = ratio >= 0.8;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={Math.min(used, limit)}
      aria-valuetext={`${used.toLocaleString('en-US')} of ${limit.toLocaleString('en-US')} tokens`}
      className={cn('grid grid-cols-[repeat(20,minmax(0,1fr))] gap-0.5', className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={cn('h-1.5', i < filled ? (warn ? 'bg-warning' : 'bg-accent') : 'bg-border')}
        />
      ))}
    </div>
  );
}
