import {
  channelListResponseSchema,
  channelResponseSchema,
  memberListResponseSchema,
  memberResponseSchema,
  messagesPageSchema,
  MESSAGES_PAGE_DEFAULT,
  workspaceListResponseSchema,
  workspaceResponseSchema,
  type CreateChannelInput,
  type CreateWorkspaceInput,
  type InviteMemberInput,
} from '@teamchat/shared';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

/** Every cache key in one place, so invalidations can't drift from the queries. */
export const queryKeys = {
  workspaces: ['workspaces'] as const,
  channels: (workspaceId: string) => ['workspaces', workspaceId, 'channels'] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  messages: (channelId: string) => ['channels', channelId, 'messages'] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: async ({ signal }) =>
      (await api('/workspaces', { signal }, workspaceListResponseSchema)).workspaces,
  });
}

export function useChannels(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.channels(workspaceId),
    queryFn: async ({ signal }) =>
      (await api(`/workspaces/${workspaceId}/channels`, { signal }, channelListResponseSchema))
        .channels,
  });
}

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.members(workspaceId),
    queryFn: async ({ signal }) =>
      (await api(`/workspaces/${workspaceId}/members`, { signal }, memberListResponseSchema))
        .members,
  });
}

export function fetchMessagesPage(channelId: string, before?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: String(MESSAGES_PAGE_DEFAULT) });
  if (before) query.set('before', before);
  return api(`/channels/${channelId}/messages?${query}`, { signal }, messagesPageSchema);
}

/**
 * History as an infinite query: page 0 = the newest 30, each next page = 30 older ones
 * (cursor = nextCursor from the previous page). Pages and messages are newest first;
 * the list reverses them for display.
 */
export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(channelId),
    queryFn: ({ pageParam, signal }) => fetchMessagesPage(channelId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Live updates arrive over the socket; a background refetch would only fight them.
    staleTime: Infinity,
  });
}

export function useCreateWorkspace() {
  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) =>
      (await api('/workspaces', { method: 'POST', body: input }, workspaceResponseSchema))
        .workspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}

export function useCreateChannel(workspaceId: string) {
  return useMutation({
    mutationFn: async (input: CreateChannelInput) =>
      (
        await api(
          `/workspaces/${workspaceId}/channels`,
          { method: 'POST', body: input },
          channelResponseSchema,
        )
      ).channel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspaceId) }),
  });
}

export function useInviteMember(workspaceId: string) {
  return useMutation({
    mutationFn: async (input: InviteMemberInput) =>
      (
        await api(
          `/workspaces/${workspaceId}/members`,
          { method: 'POST', body: input },
          memberResponseSchema,
        )
      ).member,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) }),
  });
}
