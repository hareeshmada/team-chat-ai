import type { PublicUser } from '@teamchat/shared';
import { create } from 'zustand';

/** loading = restoring the session on page load; anonymous = no valid session. */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

/** Which restore step is running; drives the loading screen checklist. */
export type RestoreStep = 'refresh' | 'profile';

interface AuthState {
  status: AuthStatus;
  restoreStep: RestoreStep;
  /** In memory only. Never persisted: localStorage is readable by any XSS script. */
  accessToken: string | null;
  user: PublicUser | null;
  setRestoreStep: (step: RestoreStep) => void;
  setAccessToken: (accessToken: string) => void;
  setSession: (accessToken: string, user: PublicUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  restoreStep: 'refresh',
  accessToken: null,
  user: null,
  setRestoreStep: (restoreStep) => set({ restoreStep }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setSession: (accessToken, user) => set({ status: 'authenticated', accessToken, user }),
  clear: () => set({ status: 'anonymous', accessToken: null, user: null }),
}));
