import type { PublicChannel, PublicMessage } from '@teamchat/shared';
import { LoaderCircle } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../../components/ui/Button';
import { NewMessagesPill } from '../../components/ui/NewMessagesPill';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../stores/auth';
import { usePendingStore, type PendingMessage } from '../../stores/pending';
import { EmptyChannel } from './EmptyChannel';
import {
  authorColor,
  createdByText,
  dayKey,
  dayLabel,
  GROUP_WINDOW_MS,
  memberName,
} from './format';
import { MessageRow } from './MessageRow';
import { useMessages } from './queries';
import { discardMessage, retryMessage } from './send';
import { useShell } from './shellContext';

/** "Near the bottom": within this many px, new messages scroll into view automatically. */
const NEAR_BOTTOM_PX = 80;

type Row =
  { kind: 'message'; message: PublicMessage } | { kind: 'pending'; message: PendingMessage };

const rowAuthor = (r: Row, meId: string) => (r.kind === 'message' ? r.message.authorId : meId);
const rowKey = (r: Row) => (r.kind === 'message' ? r.message.id : r.message.tempId);

/** Same author within 5 minutes on the same day → compact row (no author line). */
function isFollowUp(prev: Row | undefined, row: Row, meId: string): boolean {
  if (!prev) return false;
  const gap =
    new Date(row.message.createdAt).getTime() - new Date(prev.message.createdAt).getTime();
  return (
    rowAuthor(prev, meId) === rowAuthor(row, meId) &&
    gap < GROUP_WINDOW_MS &&
    dayKey(prev.message.createdAt) === dayKey(row.message.createdAt)
  );
}

export function MessageList({ channel }: { channel: PublicChannel }) {
  const { members } = useShell();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const query = useMessages(channel.id);
  const pending = usePendingStore(
    useShallow((s) =>
      Object.values(s.byTempId)
        .filter((m) => m.channelId === channel.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    ),
  );

  // Pages and their messages are newest first; the screen shows oldest → newest.
  const messages = useMemo(
    () => query.data?.pages.flatMap((p) => p.messages).reverse() ?? [],
    [query.data],
  );
  const rows: Row[] = useMemo(
    () => [
      ...messages.map((message) => ({ kind: 'message' as const, message })),
      ...pending.map((message) => ({ kind: 'pending' as const, message })),
    ],
    [messages, pending],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const snapshot = useRef({ height: 0, top: 0, firstKey: '', lastKey: '', count: 0 });
  const initialised = useRef(false); // jumped to the bottom once (the list is keyed per channel)
  const [unseen, setUnseen] = useState(0);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    nearBottom.current = true;
    setUnseen(0);
  };

  /**
   * After every change to the rows, decide how to scroll (before the browser paints):
   * - first data for this channel → jump to the bottom
   * - older messages were added at the TOP → keep what the user was reading in place
   *   (add the height that was inserted above to scrollTop)
   * - anything else (new messages, a catch-up inserting missed ones, a "sending…" row becoming
   *   the saved message) → if the user was at the bottom, stay at the bottom; a new message YOU
   *   sent always scrolls; otherwise don't jump: count new rows for the "N new messages" pill
   */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !query.data) return;
    const first = rows[0] ? rowKey(rows[0]) : '';
    const last = rows.at(-1) ? rowKey(rows.at(-1)!) : '';
    const prev = snapshot.current;
    const added = rows.length - prev.count;

    if (!initialised.current) {
      el.scrollTop = el.scrollHeight;
      initialised.current = true;
    } else if (first !== prev.firstKey && last === prev.lastKey) {
      el.scrollTop = prev.top + (el.scrollHeight - prev.height);
    } else if (added !== 0 || last !== prev.lastKey) {
      const sentNow = added > 0 && rows.at(-1)!.kind === 'pending';
      if (nearBottom.current || sentNow) scrollToBottom();
      else if (added > 0) setUnseen((n) => n + added);
    }
    snapshot.current = {
      height: el.scrollHeight,
      top: el.scrollTop,
      firstKey: first,
      lastKey: last,
      count: rows.length,
    };
  }, [rows, query.data]);

  // The list's own height changes too (a connection banner appears, the composer grows): if the
  // user was at the bottom, keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scrolling near the top loads 30 older messages. Effects run after the layout effect above,
  // so by the time this observes, the first jump to the bottom has happened.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isSuccess } = query;
  useEffect(() => {
    const root = scrollRef.current;
    const target = topRef.current;
    if (!root || !target || !isSuccess) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && initialised.current && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isSuccess, hasNextPage, isFetchingNextPage, fetchNextPage]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottom.current && unseen > 0) setUnseen(0);
    snapshot.current.top = el.scrollTop;
    snapshot.current.height = el.scrollHeight;
  }

  const isEmpty = query.isSuccess && rows.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label={`Messages in #${channel.name}`}
        // Browser scroll anchoring off: we keep the position ourselves when older pages load.
        className="flex-1 overflow-y-auto [overflow-anchor:none]"
      >
        <div className="flex min-h-full flex-col justify-end gap-1 px-3 py-2.5 md:px-5">
          <div ref={topRef} aria-hidden="true" />

          {query.isPending && <HistorySkeleton />}

          {query.isError && (
            <div
              role="alert"
              className="flex flex-col items-start gap-2 p-4 text-[13px] text-muted"
            >
              Couldn’t load messages.
              <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {isFetchingNextPage && (
            <div
              role="status"
              className="inline-flex items-center gap-2 self-center rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted"
            >
              <LoaderCircle
                size={12}
                strokeWidth={2.5}
                aria-hidden
                className="text-accent-fg motion-safe:animate-spin"
              />
              loading older messages
            </div>
          )}

          {isEmpty && <EmptyChannel channel={channel} />}

          {query.isSuccess && !hasNextPage && messages.length > 0 && (
            <div className="mb-2 flex flex-col gap-0.5 border-b border-border p-2">
              <span className="font-mono font-semibold">start of #{channel.name}</span>
              <span className="text-[13px] text-muted">
                {createdByText(channel, members, meId)} You’ve reached the first message.
              </span>
            </div>
          )}

          {rows.map((row, i) => {
            const prev = rows[i - 1];
            const newDay =
              !prev || dayKey(prev.message.createdAt) !== dayKey(row.message.createdAt);
            const authorId = rowAuthor(row, meId);
            const author = isFollowUp(prev, row, meId)
              ? undefined
              : { name: memberName(members, authorId), colorClass: authorColor(authorId) };

            return (
              <Fragment key={rowKey(row)}>
                {newDay && <DayDivider label={dayLabel(row.message.createdAt)} />}
                {row.kind === 'message' ? (
                  <MessageRow
                    createdAt={row.message.createdAt}
                    body={row.message.body}
                    author={author}
                    isOwn={row.message.authorId === meId}
                  />
                ) : (
                  <MessageRow
                    createdAt={row.message.createdAt}
                    body={row.message.body}
                    author={author}
                    state={row.message.status === 'failed' ? 'failed' : 'sending'}
                    error={row.message.error}
                    onRetry={() => retryMessage(row.message.tempId)}
                    onDiscard={() => discardMessage(row.message.tempId)}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {unseen > 0 && (
        <NewMessagesPill
          count={unseen}
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2"
        />
      )}
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2 font-mono text-[11px] text-muted">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading messages"
      className="flex flex-col gap-4 px-2 py-2"
    >
      {['w-3/5', 'w-5/6', 'w-2/5', 'w-2/3'].map((width) => (
        <div key={width} className="flex gap-3">
          <Skeleton className="h-3 w-10" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton tone="secondary" className={`h-3 ${width}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
