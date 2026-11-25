import type { AttachmentRef } from '@teamchat/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Messages the user sent that the server hasn't confirmed yet (optimistic UI).
 * queued = waiting for a connection; sending = emitted, waiting for the ack; failed = timeout
 * or rejected (text kept for retry). They live here, NOT in the query cache: they aren't
 * server data yet, so rolling back is just removing the entry.
 *
 * Kept in sessionStorage (per tab, survives a reload, gone when the tab closes): a message
 * typed while offline must still go out if the page reloads before the connection is back.
 * Not localStorage: two tabs would both send the same queue.
 */
export type PendingStatus = 'queued' | 'sending' | 'failed';

export interface PendingMessage {
  tempId: string;
  channelId: string;
  /** Who typed it: a reload can land on a different signed-in user in the same tab. */
  authorId: string;
  body: string;
  /** Files already uploaded to Cloudinary (Step 5.1); sent with the message. */
  attachments?: AttachmentRef[];
  status: PendingStatus;
  error?: string;
  createdAt: string;
}

interface PendingState {
  byTempId: Record<string, PendingMessage>;
  add: (message: PendingMessage) => void;
  update: (tempId: string, patch: Partial<PendingMessage>) => void;
  remove: (tempId: string) => void;
  /** After sign-in: drop anything another user left in this tab. */
  keepOnly: (authorId: string) => void;
  clear: () => void;
}

export const usePendingStore = create<PendingState>()(
  persist(
    (set) => ({
      byTempId: {},
      add: (message) => set((s) => ({ byTempId: { ...s.byTempId, [message.tempId]: message } })),
      update: (tempId, patch) =>
        set((s) => {
          const current = s.byTempId[tempId];
          return current ? { byTempId: { ...s.byTempId, [tempId]: { ...current, ...patch } } } : s;
        }),
      remove: (tempId) =>
        set((s) => {
          if (!(tempId in s.byTempId)) return s;
          const { [tempId]: _removed, ...rest } = s.byTempId;
          return { byTempId: rest };
        }),
      keepOnly: (authorId) =>
        set((s) => ({
          byTempId: Object.fromEntries(
            Object.entries(s.byTempId).filter(([, m]) => m.authorId === authorId),
          ),
        })),
      clear: () => set({ byTempId: {} }),
    }),
    {
      name: 'teamchat:pending',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ byTempId: s.byTempId }),
      // A message that was "sending" when the page went away may or may not have been saved:
      // don't resend it automatically (that could duplicate it); let the user retry or discard.
      merge: (persisted, current) => {
        const saved = (persisted as Partial<PendingState> | undefined)?.byTempId ?? {};
        const byTempId = Object.fromEntries(
          Object.entries(saved).map(([id, m]) => [
            id,
            m.status === 'sending'
              ? { ...m, status: 'failed' as const, error: 'Not confirmed before the page reloaded' }
              : m,
          ]),
        );
        return { ...current, byTempId };
      },
    },
  ),
);
