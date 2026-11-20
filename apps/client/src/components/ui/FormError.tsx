import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

/** Form-level error (not tied to one field), announced by screen readers via role="alert". */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger px-3 py-2 text-[13px] text-danger"
    >
      <CircleAlert size={14} aria-hidden className="mt-[3px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}
