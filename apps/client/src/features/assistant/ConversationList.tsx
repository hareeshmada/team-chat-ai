import { aiConversationsPageSchema, type AiConversationSummary } from '@teamchat/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { dayKey, dayLabel, formatTime } from '../chat/format';
import { aiConversationsKey } from './actions';

function useAiConversations() {
  return useInfiniteQuery({
    queryKey: aiConversationsKey,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams(pageParam ? { before: pageParam } : {});
      return api(`/ai/conversations?${query}`, { signal }, aiConversationsPageSchema);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** "Past conversations": newest first, grouped by day; the title is the first question. */
export function ConversationList({
  currentId,
  onOpen,
}: {
  currentId: string | null;
  onOpen: (id: string) => void;
}) {
  const query = useAiConversations();
  const conversations = query.data?.pages.flatMap((p) => p.conversations) ?? [];

  if (query.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton tone="secondary" className="h-2.5 w-1/3" />
          </div>
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 p-4 text-muted">
        Couldn’t load your conversations.
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (conversations.length === 0) {
    return <p className="m-0 p-4 text-muted">No conversations yet. Ask something to start one.</p>;
  }

  return (
    <nav aria-label="Past conversations" className="flex flex-col gap-0.5 p-2">
      {conversations.map((c, i) => (
        <Fragment key={c.id}>
          {(i === 0 || dayKey(conversations[i - 1]!.updatedAt) !== dayKey(c.updatedAt)) && (
            <span className={cn('px-2 pb-1 font-mono text-[11px] text-muted', i ? 'pt-3' : 'pt-2')}>
              {dayLabel(c.updatedAt)}
            </span>
          )}
          <ConversationRow
            conversation={c}
            current={c.id === currentId}
            onOpen={() => onOpen(c.id)}
          />
        </Fragment>
      ))}
      {query.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 self-center"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load older'}
        </Button>
      )}
    </nav>
  );
}

function ConversationRow({
  conversation: c,
  current,
  onOpen,
}: {
  conversation: AiConversationSummary;
  current: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={current || undefined}
      className={cn(
        'flex cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-fg hover:bg-surface-2',
        'focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
        current && 'bg-surface-2',
      )}
    >
      <span className="truncate">{c.title}</span>
      <span className="font-mono text-[11px] text-muted">
        {formatTime(c.updatedAt)} · {c.messageCount} {c.messageCount === 1 ? 'message' : 'messages'}
      </span>
    </button>
  );
}
