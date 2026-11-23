import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export interface ModalProps {
  title: ReactNode;
  /** Called on Esc, the close button or a click on the backdrop. */
  onClose: () => void;
  /** Footer buttons (right-aligned): usually a secondary + a primary. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Mount it to open it (`{open && <Modal …/>}`), unmount to close.
 * Native <dialog> + showModal(): the browser puts it in the top layer, makes the rest of the
 * page inert (focus can't leave it: the focus trap) and closes it on Esc. On unmount, focus
 * goes back to whatever opened it.
 */
export function Modal({ title, onClose, footer, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // showModal() focuses the first focusable element (the close button). Forms should start in
    // their first field instead (React's autoFocus ran before the dialog opened, so it was lost).
    dialog.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc fires "cancel": let React decide (the parent unmounts us) instead of closing natively.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the ::backdrop targets the <dialog> itself (the content is a child element).
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        // Short windows: header + footer stay, the body scrolls.
        'm-auto w-[calc(100%-32px)] max-w-[460px] max-h-[calc(100dvh-32px)] flex-col overflow-hidden rounded-[10px] border border-border-strong bg-surface p-0 text-fg shadow-float open:flex',
        'backdrop:bg-backdrop',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border py-3.5 pr-3 pl-5">
        <h2 id={titleId} className="flex-1 text-base font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="size-8">
          <X size={16} aria-hidden />
        </Button>
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">{children}</div>
      {footer && (
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}
