import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Slide-over panel from the left (mobile sidebar). Like Modal: native <dialog> + showModal(),
 * so the page behind is inert, Esc closes and focus returns to the opener. Mount to open.
 */
export function Drawer({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'm-0 h-dvh max-h-none w-[304px] max-w-[85vw] border-r border-border-strong bg-surface p-0 text-fg shadow-float',
        'backdrop:bg-backdrop',
        className,
      )}
    >
      {children}
    </dialog>
  );
}
