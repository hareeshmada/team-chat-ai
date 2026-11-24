import type { PublicNotification } from '@teamchat/shared';
import { create } from 'zustand';

/** At most this many toasts on screen; a new one pushes the oldest out. */
export const MAX_TOASTS = 3;
/** Auto-dismiss time (paused while hovered or focused). */
export const TOAST_DURATION_MS = 6_000;

interface ToastState {
  /** Newest first. */
  toasts: PublicNotification[];
  show: (notification: PublicNotification) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (n) =>
    set((s) =>
      s.toasts.some((t) => t.id === n.id) ? s : { toasts: [n, ...s.toasts].slice(0, MAX_TOASTS) },
    ),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
