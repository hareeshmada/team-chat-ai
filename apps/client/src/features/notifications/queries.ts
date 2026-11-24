import {
  markNotificationsReadResponseSchema,
  NOTIFICATIONS_UNREAD_CAP,
  notificationsPageSchema,
  type MarkNotificationsReadInput,
  type NotificationsPage,
  type NotificationsReadEvent,
  type PublicNotification,
} from '@teamchat/shared';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

type NotificationsData = InfiniteData<NotificationsPage, string | undefined>;

export const notificationsKey = ['notifications'] as const;

/** The bell list: newest first, "Load older" = next page. Live events are merged in by id. */
export function useNotifications(enabled = true) {
  return useInfiniteQuery({
    queryKey: notificationsKey,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams(pageParam ? { before: pageParam } : {});
      return api(`/notifications?${query}`, { signal }, notificationsPageSchema);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // The stream keeps it current (and refetches it on every (re)connect).
    staleTime: Infinity,
    enabled,
  });
}

/** Unread count for the bell and tab title (page 0 carries the server's number). */
export function useUnreadNotificationCount(): number {
  const { data } = useNotifications();
  return data?.pages[0]?.unreadCount ?? 0;
}

function update(fn: (data: NotificationsData) => NotificationsData) {
  queryClient.setQueryData<NotificationsData>(notificationsKey, (data) =>
    data && data.pages.length > 0 ? fn(data) : data,
  );
}

/** A live (or replayed) notification. Idempotent by id; returns true if it was new. */
export function insertNotification(n: PublicNotification): boolean {
  let added = false;
  update((data) => {
    if (data.pages.some((p) => p.notifications.some((x) => x.id === n.id))) return data;
    added = true;
    const [first, ...rest] = data.pages;
    const notifications = [n, ...first!.notifications].sort((a, b) => (a.id < b.id ? 1 : -1));
    const unreadCount = Math.min(first!.unreadCount + (n.readAt ? 0 : 1), NOTIFICATIONS_UNREAD_CAP);
    return { ...data, pages: [{ ...first!, notifications, unreadCount }, ...rest] };
  });
  return added;
}

/** Marks cached items read (ids, or all when null); `unreadCount` is the server's number if known. */
function applyRead(ids: string[] | null, unreadCount?: number) {
  const now = new Date().toISOString();
  const hit = (n: PublicNotification) => !n.readAt && (ids === null || ids.includes(n.id));
  update((data) => {
    const newlyRead = data.pages.reduce((sum, p) => sum + p.notifications.filter(hit).length, 0);
    return {
      ...data,
      pages: data.pages.map((p, i) => ({
        ...p,
        notifications: p.notifications.map((n) => (hit(n) ? { ...n, readAt: now } : n)),
        unreadCount:
          i === 0 ? (unreadCount ?? Math.max(0, p.unreadCount - newlyRead)) : p.unreadCount,
      })),
    };
  });
}

/** `event: read` from the stream (this tab, another tab, or reading a channel). */
export const applyReadEvent = ({ ids, unreadCount }: NotificationsReadEvent) =>
  applyRead(ids, unreadCount);

/** Optimistic: the items turn read at once; a failure puts the previous list back. */
export async function markNotificationsRead(input: MarkNotificationsReadInput): Promise<void> {
  const before = queryClient.getQueryData<NotificationsData>(notificationsKey);
  applyRead('all' in input ? null : input.ids);
  try {
    const { unreadCount } = await api(
      '/notifications/read',
      { method: 'POST', body: input },
      markNotificationsReadResponseSchema,
    );
    applyRead([], unreadCount);
  } catch {
    if (before) queryClient.setQueryData(notificationsKey, before);
  }
}

/** Newest cached id: where a first stream connect can resume from. */
export function newestNotificationId(): string | undefined {
  return queryClient.getQueryData<NotificationsData>(notificationsKey)?.pages[0]?.notifications[0]
    ?.id;
}
