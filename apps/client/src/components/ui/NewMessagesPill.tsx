import { ArrowDown } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Shown when new messages arrive while the user is scrolled up; click jumps to the bottom. */
export function NewMessagesPill({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent shadow-float hover:bg-accent-hover',
        'focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
        className,
      )}
    >
      <ArrowDown size={14} strokeWidth={2.5} aria-hidden />
      {count === 1 ? '1 new message' : `${count} new messages`}
    </button>
  );
}
