import { create } from 'zustand';

/** After this many failed attempts in a row the stream counts as offline (it keeps retrying). */
export const STREAM_OFFLINE_AFTER = 5;

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** The SSE notification stream's state, for the status bar and the dropdown footer. */
interface NotificationStreamState {
  status: StreamStatus;
  attempt: number;
  /** ISO time of the last notification received (status bar "last event 10:20"). */
  lastEventAt: string | null;
  set: (patch: Partial<Omit<NotificationStreamState, 'set'>>) => void;
}

export const useNotificationStreamStore = create<NotificationStreamState>()((set) => ({
  status: 'idle',
  attempt: 0,
  lastEventAt: null,
  set: (patch) => set(patch),
}));
