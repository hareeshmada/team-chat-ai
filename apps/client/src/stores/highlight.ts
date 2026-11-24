import { create } from 'zustand';

/** A message to scroll to and flash once (opened from a notification or toast). */
interface HighlightState {
  messageId: string | null;
  set: (messageId: string | null) => void;
}

export const useHighlightStore = create<HighlightState>()((set) => ({
  messageId: null,
  set: (messageId) => set({ messageId }),
}));
