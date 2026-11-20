import {
  authResponseSchema,
  meResponseSchema,
  type LoginInput,
  type RegisterInput,
} from '@teamchat/shared';
import { api, refreshAccessToken } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { broadcastLogout } from './broadcast';

let restorePromise: Promise<void> | null = null;

/**
 * Runs once per page load: refresh cookie → access token → /me.
 * Memoised, so StrictMode's double-invoked effect (or any second caller) reuses the same run
 * and only ONE /auth/refresh request is sent.
 */
export function restoreSession(): Promise<void> {
  restorePromise ??= (async () => {
    const store = useAuthStore.getState();
    try {
      store.setRestoreStep('refresh');
      const accessToken = await refreshAccessToken();
      store.setRestoreStep('profile');
      const { user } = await api('/auth/me', {}, meResponseSchema);
      useAuthStore.getState().setSession(useAuthStore.getState().accessToken ?? accessToken, user);
    } catch {
      // No cookie, expired or revoked session, or server unreachable: start logged out.
      useAuthStore.getState().clear();
    }
  })();
  return restorePromise;
}

export async function login(input: LoginInput): Promise<void> {
  const { accessToken, user } = await api(
    '/auth/login',
    { method: 'POST', body: input, auth: false }, // a 401 here means bad credentials, not "refresh"
    authResponseSchema,
  );
  useAuthStore.getState().setSession(accessToken, user);
}

export async function register(input: RegisterInput): Promise<void> {
  const { accessToken, user } = await api(
    '/auth/register',
    { method: 'POST', body: input, auth: false },
    authResponseSchema,
  );
  useAuthStore.getState().setSession(accessToken, user);
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST', auth: false }); // revokes + clears the cookie
  } finally {
    // Even if the request failed, forget the session locally and tell the other tabs.
    useAuthStore.getState().clear();
    broadcastLogout();
  }
}
