import type { SocketError } from '@teamchat/shared';
import { create } from 'zustand';

/**
 * Your `@ai` questions whose answer failed, by question id. Only the asker sees these ("only
 * visible to you"); the row disappears on retry or reload.
 */
interface AiFailuresState {
  byQuestionId: Record<string, { channelId: string; error: SocketError }>;
  add: (questionId: string, channelId: string, error: SocketError) => void;
  remove: (questionId: string) => void;
  clear: () => void;
}

export const useAiFailuresStore = create<AiFailuresState>()((set) => ({
  byQuestionId: {},
  add: (questionId, channelId, error) =>
    set((s) => ({ byQuestionId: { ...s.byQuestionId, [questionId]: { channelId, error } } })),
  remove: (questionId) =>
    set((s) => {
      const { [questionId]: _removed, ...rest } = s.byQuestionId;
      return { byQuestionId: rest };
    }),
  clear: () => set({ byQuestionId: {} }),
}));
