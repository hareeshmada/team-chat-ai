import {
  MESSAGES_PAGE_DEFAULT,
  type MessagesPage,
  type PublicMessage,
  type Reaction,
} from '@teamchat/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from './queries';

type MessagesData = InfiniteData<MessagesPage, string | undefined>;

const newestFirst = (a: PublicMessage, b: PublicMessage) => (a.id < b.id ? 1 : -1);

function update(channelId: string, fn: (data: MessagesData) => MessagesData) {
  queryClient.setQueryData<MessagesData>(queryKeys.messages(channelId), (data) =>
    data && data.pages.length > 0 ? fn(data) : data,
  );
}

/**
 * Puts a live message (socket ack, message:new, reconnect catch-up) into the channel's cached
 * history. Idempotent: the same message often arrives twice (ack + broadcast), so a message
 * whose id is already cached is ignored. Returns true if it was added.
 * If the channel's history was never loaded, there is nothing to update (it loads fresh later).
 */
export function insertMessage(message: PublicMessage): boolean {
  let added = false;
  update(message.channelId, (data) => {
    if (data.pages.some((p) => p.messages.some((m) => m.id === message.id))) return data;
    const [first, ...rest] = data.pages;
    // Newest first. ObjectId hex strings sort by creation time, so keep page 0 ordered by id.
    const messages = [...first!.messages, message].sort(newestFirst);
    added = true;
    return { ...data, pages: [{ ...first!, messages }, ...rest] };
  });
  return added;
}

/** Changes one cached message in place (edit, delete, reactions). Unknown ids are ignored. */
function patchMessage(
  channelId: string,
  messageId: string,
  patch: (m: PublicMessage) => PublicMessage,
) {
  update(channelId, (data) => ({
    ...data,
    pages: data.pages.map((p) =>
      p.messages.some((m) => m.id === messageId)
        ? { ...p, messages: p.messages.map((m) => (m.id === messageId ? patch(m) : m)) }
        : p,
    ),
  }));
}

/** message:updated / message:deleted / an edit or delete ack: the server's version wins. */
export function replaceMessage(message: PublicMessage) {
  patchMessage(message.channelId, message.id, () => message);
}

export function setReactions(channelId: string, messageId: string, reactions: Reaction[]) {
  patchMessage(channelId, messageId, (m) => ({ ...m, reactions }));
}

export function getCachedMessage(channelId: string, messageId: string) {
  const data = queryClient.getQueryData<MessagesData>(queryKeys.messages(channelId));
  return data?.pages.flatMap((p) => p.messages).find((m) => m.id === messageId);
}

/** Ids currently cached for a channel (to count what a reconnect catch-up added). */
export function cachedMessageIds(channelId: string): Set<string> {
  const data = queryClient.getQueryData<MessagesData>(queryKeys.messages(channelId));
  return new Set(data?.pages.flatMap((p) => p.messages.map((m) => m.id)) ?? []);
}

/**
 * A freshly fetched newest page: add what's missing AND replace what we have (it may have been
 * edited, deleted or reacted to while we weren't listening). Returns the ids that were missing.
 */
export function mergeFreshPage(channelId: string, page: MessagesPage): string[] {
  const known = cachedMessageIds(channelId);
  const missing = page.messages.filter((m) => !known.has(m.id)).map((m) => m.id);
  const fresh = new Map(page.messages.map((m) => [m.id, m]));
  update(channelId, (data) => {
    const [first, ...rest] = data.pages;
    const replaced = (msgs: PublicMessage[]) => msgs.map((m) => fresh.get(m.id) ?? m);
    const firstMessages = [
      ...replaced(first!.messages),
      ...page.messages.filter((m) => !known.has(m.id)),
    ].sort(newestFirst);
    return {
      ...data,
      pages: [
        { ...first!, messages: firstMessages },
        ...rest.map((p) => ({ ...p, messages: replaced(p.messages) })),
      ],
    };
  });
  return missing;
}

/**
 * Leaving a channel: keep only its newest page (trimmed to one page size). Events for it stop
 * arriving once we leave its room, so anything older would silently go stale; the newest page
 * is refreshed by mergeFreshPage when we come back, and older pages load fresh on scroll.
 */
export function trimToNewestPage(channelId: string) {
  update(channelId, (data) => {
    const first = data.pages[0]!;
    const trimmed = first.messages.length > MESSAGES_PAGE_DEFAULT;
    const messages = first.messages.slice(0, MESSAGES_PAGE_DEFAULT);
    const nextCursor =
      trimmed || data.pages.length > 1 || first.nextCursor
        ? (messages.at(-1)?.id ?? first.nextCursor)
        : null;
    return {
      pages: [{ messages, nextCursor }],
      pageParams: data.pageParams.slice(0, 1),
    };
  });
}
