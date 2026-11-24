import { Check } from 'lucide-react';
import { useEffect, useRef, type ComponentProps, type ReactNode, type RefObject } from 'react';
import { cn } from '../../lib/cn';
import { useDismiss } from './useDismiss';

export interface PopoverMenuProps {
  /** The button that opened the menu: outside clicks on it are ignored, focus returns to it. */
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}

const ITEM = '[role="menuitem"],[role="menuitemradio"]';

/**
 * A floating menu (mount to open). Focuses the first item; ↑/↓/Home/End move between items;
 * Esc, Tab or a click outside closes it and returns focus to the trigger.
 * Position it with `className` (e.g. "absolute top-full left-0 mt-1").
 */
export function PopoverMenu({ triggerRef, onClose, label, className, children }: PopoverMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, triggerRef, onClose);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(ITEM)?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focus = (n: number) => items[(n + items.length) % items.length]?.focus();
    if (e.key === 'ArrowDown') focus(i + 1);
    else if (e.key === 'ArrowUp') focus(i - 1);
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
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'z-30 flex w-[280px] max-w-[calc(100vw-32px)] flex-col gap-0.5 rounded-[10px] border border-border-strong bg-surface p-1.5 text-fg shadow-float',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <span className="px-2.5 py-1.5 font-mono text-[11px] text-muted">{children}</span>;
}

export function MenuDivider() {
  return <span role="separator" className="my-1 h-px bg-border" />;
}

export type MenuItemProps = ComponentProps<'button'> & {
  icon?: ReactNode;
  /** Marks the current choice (shows a check, menuitemradio + aria-checked). */
  current?: boolean;
  /** Right-side meta (e.g. a count). */
  meta?: ReactNode;
  /** action = 36px, 13px text (Create…, Invite…); option = 40px. */
  kind?: 'option' | 'action';
};

export function MenuItem({
  icon,
  current,
  meta,
  kind = 'option',
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <button
      type="button"
      role={current === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={current === undefined ? undefined : current}
      tabIndex={-1}
      {...props}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left outline-none',
        'hover:bg-surface-2 focus-visible:bg-surface-2',
        kind === 'option' ? 'h-10' : 'h-9 text-[13px]',
        current && 'bg-surface-2',
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta}
      {current && (
        <Check size={14} strokeWidth={2.5} aria-label="current" className="text-accent-fg" />
      )}
    </button>
  );
}
