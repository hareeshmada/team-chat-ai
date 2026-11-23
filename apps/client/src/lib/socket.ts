import {
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@teamchat/shared';
import { io, type Socket } from 'socket.io-client';
import { OFFLINE_AFTER_ATTEMPTS, useConnectionStore } from '../stores/connection';
import { useAuthStore } from '../stores/auth';
import { refreshAccessToken } from './api';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One socket for the whole session (module singleton, created once, connected only while
 * signed in). Components attach listeners to it with socket.on/off at any time.
 *
 * `auth` is a FUNCTION, called on every (re)connect, so each handshake sends the CURRENT access
 * token from the store, not the one we had at login (it expires after 15 min).
 * Same origin: the Vite proxy (and later Nginx) forwards /socket.io to the server.
 */
export const socket: AppSocket = io({
  autoConnect: false,
  auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
});

const AUTH_ERRORS = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHORIZED']);
const LATENCY_EVERY_MS = 10_000;

let started = false;
let authRetried = false;
let latencyTimer: ReturnType<typeof setInterval> | undefined;

function measureLatency() {
  const start = performance.now();
  socket.timeout(5_000).emit(SOCKET_EVENTS.latencyPing, (err) => {
    useConnectionStore.getState().setLatency(err ? null : Math.round(performance.now() - start));
  });
}

/**
 * Wires the socket to the auth state. Idempotent (StrictMode runs effects twice).
 * - signed in → connect; signed out (or another tab logged out) → disconnect
 * - handshake rejected for the token → refresh it once (shared single-flight with HTTP), reconnect
 * - connection lost → Socket.IO retries by itself; we only mirror the state for the UI
 */
export function startSocketLifecycle(): void {
  if (started) return;
  started = true;
  const connection = useConnectionStore.getState;

  socket.on('connect', () => {
    authRetried = false;
    connection().setStatus('connected');
    measureLatency();
    clearInterval(latencyTimer);
    latencyTimer = setInterval(measureLatency, LATENCY_EVERY_MS);
  });

  socket.on('disconnect', (reason) => {
    clearInterval(latencyTimer);
    connection().setLatency(null);
    if (reason === 'io client disconnect') {
      connection().setStatus('idle'); // we disconnected on purpose (logout)
      return;
    }
    connection().setStatus('reconnecting', 1);
    // The server kicked us (e.g. it's shutting down): Socket.IO does NOT retry this one by itself.
    if (reason === 'io server disconnect') socket.connect();
  });

  // Fired by the Manager before each automatic retry (server down, network lost).
  socket.io.on('reconnect_attempt', (attempt) => {
    connection().setStatus(attempt > OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting', attempt);
  });

  socket.on('connect_error', async (err) => {
    const code = (err as Error & { data?: { code?: string } }).data?.code;
    // A middleware rejection (our handshake auth) is NOT retried by Socket.IO: we handle it.
    if (code && AUTH_ERRORS.has(code) && !socket.active) {
      if (authRetried) return void useAuthStore.getState().clear(); // still rejected: sign out
      authRetried = true;
      try {
        await refreshAccessToken();
        socket.connect();
      } catch {
        useAuthStore.getState().clear(); // refresh failed: the session is over → /login
      }
    }
  });

  const sync = () => {
    const { status, accessToken } = useAuthStore.getState();
    if (status === 'authenticated' && accessToken) {
      if (!socket.connected && !socket.active) {
        if (connection().status === 'idle') connection().setStatus('connecting');
        socket.connect();
      }
    } else if (socket.active || socket.connected) {
      socket.disconnect();
    }
  };
  useAuthStore.subscribe(sync);
  sync();
}

/** "Retry now": start over immediately instead of waiting for the next backoff step. */
export function reconnectNow(): void {
  socket.disconnect();
  useConnectionStore.getState().setStatus('reconnecting', 1);
  socket.connect();
}
