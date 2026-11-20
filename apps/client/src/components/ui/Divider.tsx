import { cn } from '../../lib/cn';

/** Horizontal rule with an optional centered mono label, e.g. "or". */
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn('border-border', className)} />;

  return (
    <div
      role="separator"
      aria-label={label}
      className={cn('flex items-center gap-3 font-mono text-[11px] text-muted', className)}
    >
      <span className="h-px flex-1 bg-border" />
      <span aria-hidden="true">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
