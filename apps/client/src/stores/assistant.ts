import type { AiRole } from '@teamchat/shared';
import { create } from 'zustand';

/**
 * Client state of the AI assistant panel. The streaming logic lives in
 * features/assistant/actions.ts; this store only holds what the UI renders.
 */
export interface ChatMessage {
  /** Stable React key (local; server messages have no id). */
  key: string;
  role: AiRole;
  content: string;
  /** Stopped by the user before it finished: content is partial. */
  stopped?: boolean;
}

export interface AiFailure {
  /** 'cut' = broke mid-answer (partial text kept); 'error' = failed before any text. */
  kind: 'cut' | 'error';
  title: string;
  detail?: string;
  /** Retry resends this. */
  question: string;
}

export type AssistantStatus = 'idle' | 'loading' | 'waiting' | 'streaming';

interface AssistantState {
  open: boolean;
  view: 'chat' | 'history';
  conversationId: string | null;
  title: string | null;
  messages: ChatMessage[];
  status: AssistantStatus;
  /** Estimated tokens per second while streaming (characters ÷ 4: the browser only sees text). */
  tokensPerSecond: number | null;
  failure: AiFailure | null;
  /** Text to put in the ask box (a suggestion, or a question stopped before any answer). */
  draft: string;
  setOpen: (open: boolean) => void;
  setView: (view: 'chat' | 'history') => void;
  setDraft: (draft: string) => void;
  reset: () => void;
}

const PANEL_KEY = 'teamchat:assistant-panel';

/** Remembered per browser; without a saved choice it's open on wide screens only (≥ 1280px). */
function initialOpen(): boolean {
  try {
    const saved = localStorage.getItem(PANEL_KEY);
    if (saved) return saved === 'open';
  } catch {
    // storage blocked: fall through to the default
  }
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches;
}

const emptyConversation = {
  view: 'chat' as const,
  conversationId: null,
  title: null,
  messages: [],
  status: 'idle' as const,
  tokensPerSecond: null,
  failure: null,
  draft: '',
};

export const useAssistantStore = create<AssistantState>()((set) => ({
  open: initialOpen(),
  ...emptyConversation,
  setOpen: (open) => {
    try {
      localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed');
    } catch {
      // not remembered; still works for this page load
    }
    set({ open });
  },
  setView: (view) => set({ view }),
  setDraft: (draft) => set({ draft }),
  reset: () => set(emptyConversation),
}));

export const assistantBusy = (s: AssistantStatus) => s === 'waiting' || s === 'streaming';
