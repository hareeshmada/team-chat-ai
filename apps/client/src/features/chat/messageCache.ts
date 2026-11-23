import type { MessagesPage, PublicMessage } from '@teamchat/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from './queries';

type MessagesData = InfiniteData<MessagesPage, string | undefined>;

/**
 * Puts a live message (socket ack, message:new, reconnect catch-up) into the channel's cached
 * history. Idempotent: the same message often arrives twice (ack + broadcast), so a message
 * whose id is already cached is ignored. Returns true if it was added.
 * If the channel's history was never loaded, there is nothing to update (it loads fresh later).
 */
export function insertMessage(message: PublicMessage): boolean {
  let added = false;
  queryClient.setQueryData<MessagesData>(queryKeys.messages(message.channelId), (data) => {
    if (!data || data.pages.length === 0) return data;
    if (data.pages.some((p) => p.messages.some((m) => m.id === message.id))) return data;

    const [first, ...rest] = data.pages;
    // Newest first. ObjectId hex strings sort by creation time, so keep page 0 ordered by id.
    const messages = [...first!.messages, message].sort((a, b) => (a.id < b.id ? 1 : -1));
    added = true;
    return { ...data, pages: [{ ...first!, messages }, ...rest] };
  });
  return added;
}

/** Ids currently cached for a channel (to count what a reconnect catch-up added). */
export function cachedMessageIds(channelId: string): Set<string> {
  const data = queryClient.getQueryData<MessagesData>(queryKeys.messages(channelId));
  return new Set(data?.pages.flatMap((p) => p.messages.map((m) => m.id)) ?? []);
}
