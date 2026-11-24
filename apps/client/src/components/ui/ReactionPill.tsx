import { useId } from 'react';
import { cn } from '../../lib/cn';

export interface ReactionPillProps {
  emoji: string;
  /** Accessible name of the emoji ("thumbs up"). */
  label: string;
  count: number;
  /** You reacted with it: accent outline + soft accent fill, aria-pressed. */
  reacted: boolean;
  /** Tooltip on hover/focus: "priya, arjun and you reacted with 👍". */
  who: string;
  onClick: () => void;
}

/** One reaction under a message (DESIGN §8 ReactionPill). Click toggles yours. */
export function ReactionPill({ emoji, label, count, reacted, who, onClick }: ReactionPillProps) {
  const tipId = useId();
  return (
    <span className="group/pill relative inline-flex">
      <button
        type="button"
        aria-pressed={reacted}
        aria-label={`${label}, ${count} ${count === 1 ? 'reaction' : 'reactions'}${reacted ? ' including yours' : ''}`}
        aria-describedby={tipId}
        onClick={onClick}
        className={cn(
          'inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-md border px-2 font-mono text-xs',
          'focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
          reacted
            ? 'border-accent bg-accent-soft text-accent-fg'
            : 'border-border-strong text-fg hover:bg-surface-2',
        )}
      >
        <span aria-hidden="true">{emoji}</span>
        <span aria-hidden="true">{count}</span>
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 w-max max-w-[260px] rounded bg-fg px-2 py-1 text-xs text-bg opacity-0 transition-opacity group-focus-within/pill:opacity-100 group-hover/pill:opacity-100"
      >
        {who}
      </span>
    </span>
  );
}
