import { create } from 'zustand';

/**
 * idle = not connected because nobody is signed in; connecting = first connect of the session;
 * connected; reconnecting = lost, retrying; offline = still retrying, but failed several times.
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** After this many failed attempts the banner turns red ("Can't reach the server"). */
export const OFFLINE_AFTER_ATTEMPTS = 5;

interface ConnectionState {
  status: ConnectionStatus;
  attempt: number;
  latencyMs: number | null;
  /** Set after a REconnect once the open channel has caught up: drives "Back online. N missed…". */
  backOnline: { at: number; missed: number } | null;
  setStatus: (status: ConnectionStatus, attempt?: number) => void;
  setLatency: (ms: number | null) => void;
  setBackOnline: (missed: number) => void;
  clearBackOnline: () => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  status: 'idle',
  attempt: 0,
  latencyMs: null,
  backOnline: null,
  setStatus: (status, attempt = 0) => set({ status, attempt }),
  setLatency: (latencyMs) => set({ latencyMs }),
  setBackOnline: (missed) => set({ backOnline: { at: Date.now(), missed } }),
  clearBackOnline: () => set({ backOnline: null }),
}));
