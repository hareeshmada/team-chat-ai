import { REACTION_LABELS, REACTIONS, type ReactionEmoji } from '@teamchat/shared';
import { useEffect, useRef, type RefObject } from 'react';
import { cn } from '../../lib/cn';
import { useDismiss } from './useDismiss';

export interface ReactionPickerProps {
  triggerRef: RefObject<HTMLElement | null>;
  onPick: (emoji: ReactionEmoji) => void;
  onClose: () => void;
  /** Position it (e.g. "absolute bottom-full right-0 mb-1"). */
  className?: string;
}

/**
 * The six quick reactions in one row (DESIGN §8 ReactionPicker). Mount to open. Focuses the
 * first emoji; ←/→/Home/End move; picking one toggles it and closes; Esc/Tab/outside click close.
 */
export function ReactionPicker({ triggerRef, onPick, onClose, className }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, triggerRef, onClose);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focus = (n: number) => items[(n + items.length) % items.length]?.focus();
    if (e.key === 'ArrowRight') focus(i + 1);
    else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'Home') focus(0);
    else if (e.key === 'End') focus(items.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') triggerRef.current?.focus();
      onClose();
      return;
    } else return;
    e.preventDefault();
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Pick a reaction"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        'z-30 flex gap-0.5 rounded-[10px] border border-border-strong bg-surface p-1 shadow-float',
        className,
      )}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitem"
          aria-label={REACTION_LABELS[emoji]}
          onClick={() => {
            onPick(emoji);
            onClose();
          }}
          className="size-10 cursor-pointer rounded-md text-xl hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
