import { create } from 'zustand';

/**
 * Files attached in the composer (Step 5.1), per channel, until the message is sent.
 * uploading → ready (has a publicId) | failed (retry); too-large / type never upload.
 * Not persisted: a File can't be saved, and a reload starts with an empty composer.
 */
export type UploadStatus = 'uploading' | 'ready' | 'failed' | 'too-large' | 'type';

export interface UploadItem {
  id: string;
  channelId: string;
  file: File;
  status: UploadStatus;
  loaded: number;
  publicId?: string;
  error?: string;
}

interface UploadsState {
  items: UploadItem[];
  /** Files left out by the 5-per-message limit at the last add, per channel. */
  skipped: Record<string, number>;
  setSkipped: (channelId: string, count: number) => void;
  add: (items: UploadItem[]) => void;
  update: (id: string, patch: Partial<UploadItem>) => void;
  remove: (ids: string[]) => void;
  clear: () => void;
}

export const useUploadsStore = create<UploadsState>()((set) => ({
  items: [],
  skipped: {},
  setSkipped: (channelId, count) => set((s) => ({ skipped: { ...s.skipped, [channelId]: count } })),
  add: (items) => set((s) => ({ items: [...s.items, ...items] })),
  update: (id, patch) =>
    set((s) => ({ items: s.items.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
  remove: (ids) => set((s) => ({ items: s.items.filter((u) => !ids.includes(u.id)) })),
  clear: () => set({ items: [], skipped: {} }),
}));
