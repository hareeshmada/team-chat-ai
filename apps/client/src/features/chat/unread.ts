import {
  markReadResponseSchema,
  unreadResponseSchema,
  UNREAD_CAP,
  type ChannelActivityPayload,
  type ChannelUnread,
} from '@teamchat/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { api } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { useAuthStore } from '../../stores/auth';

/**
 * Unread + mention counts for every channel you can see (all workspaces), from GET /unread,
 * then kept current by socket events: channel:activity (+1), channel:read (another tab read it)
 * and a refetch after every reconnect.
 */
export const unreadKey = ['unread'] as const;

export function useUnread() {
  return useQuery({
    queryKey: unreadKey,
    queryFn: async ({ signal }) =>
      (await api('/unread', { signal }, unreadResponseSchema)).channels,
    // Socket events keep it current; refetch only on reconnect (see realtime.ts).
    staleTime: Infinity,
  });
}

/** Counts by channel id (for the sidebar). */
export function useUnreadByChannel(): Map<string, ChannelUnread> {
  const { data } = useUnread();
  return new Map(data?.map((c) => [c.channelId, c]));
}

/** "99+" past the cap the server counts to. */
export const formatCount = (n: number) => (n >= UNREAD_CAP ? '99+' : String(n));

function patchChannel(channelId: string, patch: (c: ChannelUnread) => ChannelUnread) {
  queryClient.setQueryData<ChannelUnread[]>(unreadKey, (list) =>
    list?.map((c) => (c.channelId === channelId ? patch(c) : c)),
  );
}

/** A message was posted somewhere: +1 (and +1 mention if it names you), unless it's yours. */
export function bumpUnread({ channelId, authorId, mentionedUserIds }: ChannelActivityPayload) {
  const me = useAuthStore.getState().user?.id;
  if (!me || authorId === me) return;
  const known = queryClient.getQueryData<ChannelUnread[]>(unreadKey);
  if (known && !known.some((c) => c.channelId === channelId)) {
    // A channel we don't know yet (new, or we were just added to it): ask the server.
    void queryClient.invalidateQueries({ queryKey: unreadKey });
    return;
  }
  const mentioned = mentionedUserIds.includes(me);
  patchChannel(channelId, (c) => ({
    ...c,
    count: Math.min(c.count + 1, UNREAD_CAP),
    mentionCount: mentioned ? Math.min(c.mentionCount + 1, UNREAD_CAP) : c.mentionCount,
  }));
}

/** The read marker moved (this tab or another): nothing before it is unread any more. */
export function applyRead(channelId: string, lastReadMessageId: string) {
  patchChannel(channelId, (c) =>
    c.lastReadMessageId && c.lastReadMessageId >= lastReadMessageId
      ? c
      : { ...c, count: 0, mentionCount: 0, lastReadMessageId },
  );
}

const MARK_READ_DELAY_MS = 1_000;

/**
 * "The user can see this page": the tab is visible AND the window has focus. An open channel in
 * a background tab, a minimised window or behind another app's window is not being read.
 */
export const isWatching = () => document.visibilityState === 'visible' && document.hasFocus();

function subscribeWatching(onChange: () => void) {
  window.addEventListener('focus', onChange);
  window.addEventListener('blur', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener('blur', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

/** Re-renders when the user starts or stops watching the page (see isWatching). */
export function useIsWatching(): boolean {
  return useSyncExternalStore(subscribeWatching, isWatching);
}

/**
 * Marks the open channel read up to `newestId` while the user can actually see it: the tab is
 * visible AND the window has focus (a channel open in a background window stays unread).
 * Debounced, so a burst of messages sends one request. Re-checks on focus / visibility change.
 */
export function useMarkRead(channelId: string, newestId: string | undefined) {
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!newestId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      if (!isWatching()) return;
      const current = queryClient
        .getQueryData<ChannelUnread[]>(unreadKey)
        ?.find((c) => c.channelId === channelId);
      const alreadyRead =
        (current?.lastReadMessageId ?? '') >= newestId && (current?.count ?? 0) === 0;
      if (alreadyRead || sent.current === newestId) return;
      timer = setTimeout(() => {
        sent.current = newestId;
        api(
          `/channels/${channelId}/read`,
          { method: 'POST', body: { messageId: newestId } },
          markReadResponseSchema,
        )
          .then(({ lastReadMessageId }) => applyRead(channelId, lastReadMessageId))
          .catch(() => {
            sent.current = null; // try again on the next change / focus
          });
      }, MARK_READ_DELAY_MS);
    };

    schedule();
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [channelId, newestId]);
}
