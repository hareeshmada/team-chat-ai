import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A panel docked to the bottom of the screen (mobile message actions). Same <dialog> mechanics
 * as Modal and Drawer: inert page, Esc closes, backdrop tap closes, focus returns. Mount to open.
 * The children draw the sheet itself (DESIGN §8 "Mobile message actions sheet").
 */
export function BottomSheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
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
      className="mx-auto mt-auto mb-0 w-full max-w-[480px] bg-transparent px-3 pb-3 text-fg backdrop:bg-backdrop"
    >
      {children}
    </dialog>
  );
}
