import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  /** Shown above the buttons (e.g. the request failed). */
  error?: string;
}

/**
 * A small yes/no dialog (max-width 380px, DESIGN §8 "Deleted placeholder" confirm). Same
 * <dialog> mechanics as Modal: inert page, Esc cancels, focus returns to the opener. Focus
 * starts on Cancel, so Enter right after opening doesn't destroy anything.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
  error,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-cancel]')?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[380px] flex-col gap-2.5 rounded-[10px] border border-border-strong bg-surface p-5 text-fg shadow-float backdrop:bg-backdrop open:flex"
    >
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      <p id={textId} className="text-[13px] text-muted">
        {children}
      </p>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-1.5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" data-cancel onClick={onClose} className="h-9 px-3.5">
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onConfirm}
          disabled={busy}
          className="h-9 px-3.5"
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
