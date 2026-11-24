import type { PublicNotification } from '@teamchat/shared';
import { create } from 'zustand';

const PREF_KEY = 'teamchat:desktop-notifications';

export const desktopSupported = typeof window !== 'undefined' && 'Notification' in window;

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === 'on';
  } catch {
    return false; // storage blocked (private mode): default off
  }
}

function writePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // not saved; it still works for this page load
  }
}

/**
 * OS-level notifications (browser Notification API) for mentions while you're not looking at
 * TeamChat. Two switches: the browser's permission, and the user's own on/off (saved per browser).
 * `openRequest`: an OS notification was clicked; the app (inside the router) opens it.
 */
interface DesktopNotificationsState {
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;
  openRequest: PublicNotification | null;
  enable: () => Promise<void>;
  disable: () => void;
  requestOpen: (n: PublicNotification | null) => void;
}

export const useDesktopNotificationsStore = create<DesktopNotificationsState>()((set) => ({
  permission: desktopSupported ? Notification.permission : 'unsupported',
  enabled: desktopSupported && Notification.permission === 'granted' && readPref(),
  openRequest: null,
  // Must run from a click: browsers ignore permission requests that aren't a user gesture.
  enable: async () => {
    if (!desktopSupported) return;
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    const enabled = permission === 'granted';
    writePref(enabled);
    set({ permission, enabled });
  },
  disable: () => {
    writePref(false);
    set({ enabled: false });
  },
  requestOpen: (openRequest) => set({ openRequest }),
}));
