import { REACTION_LABELS, REACTIONS, type ReactionEmoji } from '@teamchat/shared';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { cn } from '../../lib/cn';

const row =
  'flex h-[52px] w-full cursor-pointer items-center gap-3.5 rounded-lg px-3.5 text-left text-[15px] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none';

/**
 * Touch layouts: long-press a message → this sheet instead of the hover toolbar
 * (DESIGN §8 "Mobile message actions sheet", reference day3-mobile-actions.html).
 */
export function MessageActionsSheet({
  preview,
  onReact,
  onEdit,
  onCopy,
  onDelete,
  onClose,
}: {
  preview: ReactNode;
  onReact: (emoji: ReactionEmoji) => void;
  onEdit?: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <BottomSheet label="Message actions" onClose={onClose}>
      <div className="mb-2.5 rounded-[10px] border border-border-strong bg-surface px-3 py-2.5 text-[15px]">
        {preview}
      </div>
      <section className="overflow-hidden rounded-[14px] border border-border-strong bg-surface shadow-float">
        <div className="flex justify-center pt-2 pb-1" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-border-strong" />
        </div>
        <div
          role="group"
          aria-label="Quick reactions"
          className="flex justify-between border-b border-border px-3 pt-1.5 pb-3"
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={REACTION_LABELS[emoji]}
              onClick={then(() => onReact(emoji))}
              className="size-12 cursor-pointer rounded-full bg-surface-2 text-[22px] focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex flex-col p-1">
          {onEdit && (
            <button type="button" onClick={then(onEdit)} className={row}>
              <Pencil size={18} aria-hidden className="text-muted" />
              Edit message
            </button>
          )}
          <button type="button" onClick={then(onCopy)} className={row}>
            <Copy size={18} aria-hidden className="text-muted" />
            Copy text
          </button>
          {onDelete && (
            <button type="button" onClick={then(onDelete)} className={cn(row, 'text-danger')}>
              <Trash2 size={18} aria-hidden />
              Delete message
            </button>
          )}
        </div>
      </section>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 h-[52px] w-full cursor-pointer rounded-[14px] border border-border-strong bg-surface font-semibold focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        Cancel
      </button>
    </BottomSheet>
  );
}
