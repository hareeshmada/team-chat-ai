import type { ReactNode } from 'react';

/** Small uppercase mono label on accent, e.g. "BOT". */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] bg-accent px-1 font-mono text-[10px] text-on-accent uppercase">
      {children}
    </span>
  );
}
