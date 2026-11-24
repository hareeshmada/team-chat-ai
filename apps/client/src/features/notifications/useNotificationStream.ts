import {
  notificationsReadEventSchema,
  publicNotificationSchema,
  SSE_EVENTS,
  streamTicketResponseSchema,
  type PublicNotification,
} from '@teamchat/shared';
import { useEffect } from 'react';
import { api } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { useAuthStore } from '../../stores/auth';
import { STREAM_OFFLINE_AFTER, useNotificationStreamStore } from '../../stores/notificationStream';
import { useToastStore } from '../../stores/toasts';
import { isWatching } from '../chat/unread';
import { showDesktopNotification } from './desktop';
import {
  applyReadEvent,
  insertNotification,
  newestNotificationId,
  notificationsKey,
} from './queries';

const BASE_URL = import.meta.env.VITE_API_URL;
const MAX_BACKOFF_MS = 30_000;
/** A replayed mention older than this updates the bell but doesn't pop a toast. */
const TOAST_MAX_AGE_MS = 60_000;

/** "/app/:workspaceId/:channelId" → channelId (the channel on screen), else null. */
function openChannelId(): string | null {
  return /^\/app\/[a-f\d]{24}\/([a-f\d]{24})/i.exec(window.location.pathname)?.[1] ?? null;
}

/**
 * Mentions only, never stale replayed ones. If you're NOT looking at TeamChat (tab hidden or
 * window unfocused): an OS notification when enabled, otherwise a toast that waits for you.
 * If you ARE looking: a toast, except for the channel on screen (you can see the message).
 */
function maybeToast(n: PublicNotification) {
  if (n.type !== 'mention' || n.readAt) return;
  if (Date.now() - new Date(n.createdAt).getTime() > TOAST_MAX_AGE_MS) return;
  if (!isWatching()) {
    if (!showDesktopNotification(n)) useToastStore.getState().show(n);
    return;
  }
  if (n.payload.channelId === openChannelId()) return;
  useToastStore.getState().show(n);
}

/**
 * Opens the notification stream and keeps it open while signed in.
 *
 * Every (re)connect: get a fresh single-use ticket (normal authenticated POST, so an expired
 * access token refreshes first), then open a NEW EventSource with ?lastEventId=<last seen id>;
 * the server replays what we missed. We never rely on EventSource's built-in reconnect: it would
 * reuse the old (already used) ticket. On error: close, back off (1 s, 2 s, 4 s … 30 s + jitter),
 * try again; the browser's "online" event retries at once.
 * After each open the list is refetched, which also covers anything created before the first
 * connect (duplicates are dropped by id).
 */
function openNotificationStream(): () => void {
  const status = useNotificationStreamStore.getState().set;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let stopped = false;
  let lastId: string | undefined;

  const scheduleRetry = () => {
    if (stopped) return;
    attempt += 1;
    status({ status: attempt > STREAM_OFFLINE_AFTER ? 'offline' : 'reconnecting', attempt });
    const base = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** (attempt - 1));
    timer = setTimeout(() => void connect(), base / 2 + Math.random() * (base / 2));
  };

  const connect = async () => {
    if (stopped) return;
    clearTimeout(timer);
    let ticket: string;
    try {
      ({ ticket } = await api(
        '/notifications/stream-ticket',
        { method: 'POST' },
        streamTicketResponseSchema,
      ));
    } catch {
      return scheduleRetry(); // server down, or the session ended (then we get stopped)
    }
    if (stopped) return;

    const resumeFrom = lastId ?? newestNotificationId();
    const query = new URLSearchParams({ ticket, ...(resumeFrom && { lastEventId: resumeFrom }) });
    const es = new EventSource(`${BASE_URL}/notifications/stream?${query}`);
    source = es;

    es.onopen = () => {
      attempt = 0;
      status({ status: 'connected', attempt: 0 });
      void queryClient.invalidateQueries({ queryKey: notificationsKey });
    };
    es.addEventListener(SSE_EVENTS.notification, (e) => {
      const n = publicNotificationSchema.parse(JSON.parse((e as MessageEvent<string>).data));
      lastId = n.id;
      status({ lastEventAt: new Date().toISOString() });
      insertNotification(n);
      // Not gated on "was it new to the cache": the list refetch after open can win the race
      // and already contain a brand-new mention. The toast store de-duplicates by id.
      maybeToast(n);
    });
    es.addEventListener(SSE_EVENTS.read, (e) => {
      applyReadEvent(
        notificationsReadEventSchema.parse(JSON.parse((e as MessageEvent<string>).data)),
      );
    });
    es.onerror = () => {
      // Never let EventSource retry on its own (it would reuse the spent ticket).
      es.close();
      if (source === es) source = null;
      scheduleRetry();
    };
  };

  const onOnline = () => {
    if (!source && !stopped) {
      attempt = 0;
      void connect();
    }
  };
  window.addEventListener('online', onOnline);

  status({ status: 'connecting', attempt: 0 });
  void connect();

  return () => {
    stopped = true;
    clearTimeout(timer);
    source?.close();
    window.removeEventListener('online', onOnline);
    status({ status: 'idle', attempt: 0, lastEventAt: null });
  };
}

/** Mount once (App): the stream runs while signed in and stops on sign-out. */
export function useNotificationStream(): void {
  const signedIn = useAuthStore((s) => s.status === 'authenticated');
  useEffect(() => (signedIn ? openNotificationStream() : undefined), [signedIn]);
}
