import { Pencil, SmilePlus, Trash2 } from 'lucide-react';
import type { MouseEvent, RefObject } from 'react';
import { cn } from '../../lib/cn';

export interface MessageActionsToolbarProps {
  reactRef: RefObject<HTMLButtonElement | null>;
  onReact: () => void;
  /** Only passed for your own messages. */
  onEdit?: () => void;
  /** Only passed for your own messages; receives the click (Shift+click skips the confirm). */
  onDelete?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

const button =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none';

/**
 * Floating actions at a message's top-right (DESIGN §8 MessageActionsToolbar). The row decides
 * when it's visible (hover / focus inside the row); it stays in the tab order either way, so
 * tabbing into a row reveals it.
 */
export function MessageActionsToolbar({
  reactRef,
  onReact,
  onEdit,
  onDelete,
  className,
}: MessageActionsToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Message actions"
      className={cn(
        'flex gap-0.5 rounded-md border border-border-strong bg-surface p-0.5 shadow-float',
        className,
      )}
    >
      <button
        ref={reactRef}
        type="button"
        aria-label="Add reaction"
        onClick={onReact}
        className={cn(button, 'text-fg')}
      >
        <SmilePlus size={16} aria-hidden />
      </button>
      {onEdit && (
        <button
          type="button"
          aria-label="Edit message"
          onClick={onEdit}
          className={cn(button, 'text-fg')}
        >
          <Pencil size={15} aria-hidden />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label="Delete message"
          title="Delete (Shift+click skips the confirmation)"
          onClick={onDelete}
          className={cn(button, 'text-danger')}
        >
          <Trash2 size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}
