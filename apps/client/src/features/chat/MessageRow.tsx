import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { formatTime } from './format';

export type MessageState = 'sent' | 'sending' | 'failed';

export interface MessageRowProps {
  createdAt: string;
  /** The rendered body (mention chips already applied). */
  body: ReactNode;
  /** Hidden for a follow-up from the same author (compact row). */
  author?: { name: string; colorClass: string };
  state?: MessageState;
  /** Your own delivered messages show "sent" on hover. */
  isOwn?: boolean;
  error?: string;
  onRetry?: () => void;
  onDiscard?: () => void;
  /** Day 3: "(edited)" after the text. */
  edited?: boolean;
  /** Day 3: soft-deleted → italic "message deleted" placeholder, nothing else. */
  deleted?: boolean;
  /** Day 3: the message mentions you → soft accent tint. */
  mentionsMe?: boolean;
  /** Replaces the body while editing (InlineEditor). */
  editor?: ReactNode;
  /** Reaction pills under the body. */
  reactions?: ReactNode;
  /** Hover/focus actions (MessageActionsToolbar), absolutely placed at the top-right. */
  toolbar?: ReactNode;
  /** A failed edit/delete/reaction, shown under the body. */
  actionError?: string;
  /** Extra props for the <article> (long-press handlers on touch). */
  rowProps?: HTMLAttributes<HTMLElement>;
  /** Opened from a notification: flash an accent ring for a moment. */
  highlighted?: boolean;
  /** Day 4 (bot messages): after the author name, e.g. the BOT badge + "streaming". */
  authorExtra?: ReactNode;
  /** Day 4: the body is block content (markdown), so it isn't wrapped in a <p>. */
  richBody?: boolean;
  /** Day 4: a mono line under the body ("asked by karthik · based on the last 30 messages"). */
  footer?: ReactNode;
  /** Day 4: an answer still being written: `surface` background + aria-busy. */
  busy?: boolean;
}

/** One message: 52px time column + content. States per DESIGN §8 "MessageRow states". */
export function MessageRow({
  createdAt,
  body,
  author,
  state = 'sent',
  isOwn,
  error,
  onRetry,
  onDiscard,
  edited,
  deleted,
  mentionsMe,
  editor,
  reactions,
  toolbar,
  actionError,
  rowProps,
  highlighted,
  authorExtra,
  richBody,
  footer,
  busy,
}: MessageRowProps) {
  const time = formatTime(createdAt);

  if (deleted) {
    return (
      <article className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-md px-2 py-0.5 max-md:grid-cols-[minmax(0,1fr)] max-md:px-1">
        <time dateTime={createdAt} className="pt-0.5 font-mono text-xs text-muted max-md:hidden">
          {time}
        </time>
        <p className="text-muted italic">message deleted</p>
      </article>
    );
  }

  return (
    <article
      {...rowProps}
      aria-busy={busy || undefined}
      className={cn(
        'group relative grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 rounded-md px-2 max-md:grid-cols-[minmax(0,1fr)] max-md:gap-0.5 max-md:px-1',
        author ? 'py-1.5' : 'py-0.5',
        state === 'failed' && 'bg-danger/8 py-1.5',
        mentionsMe && state === 'sent' && 'bg-accent-soft',
        // The row you're pointing at (or tabbing through) lifts to `surface`, like the reference.
        Boolean(toolbar) && !mentionsMe && 'md:focus-within:bg-surface md:hover:bg-surface',
        Boolean(editor) && 'bg-surface py-1.5',
        highlighted && 'ring-2 ring-accent ring-inset',
        busy && 'bg-surface py-2',
      )}
    >
      <time dateTime={createdAt} className="pt-0.5 font-mono text-xs text-muted max-md:hidden">
        {time}
      </time>
      <div className="flex min-w-0 flex-col gap-0.5">
        {author && (
          <span className="flex items-baseline gap-2">
            <span className={cn('font-semibold', author.colorClass)}>{author.name}</span>
            {authorExtra}
            <time dateTime={createdAt} className="font-mono text-[11px] text-muted md:hidden">
              {time}
            </time>
          </span>
        )}
        {editor ??
          (richBody ? (
            <div className="min-w-0">{body}</div>
          ) : (
            <p
              className={cn('break-words whitespace-pre-wrap', state === 'sending' && 'text-muted')}
            >
              {body}
              {edited && <span className="ml-1 font-mono text-[11px] text-muted">(edited)</span>}
            </p>
          ))}
        {footer && <span className="font-mono text-[11px] text-muted">{footer}</span>}
        {reactions}
        {actionError && (
          <span role="alert" className="font-mono text-[11px] text-danger">
            {actionError}
          </span>
        )}
        {state === 'sending' && <span className="font-mono text-[11px] text-muted">sending…</span>}
        {state === 'failed' && (
          <span
            className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] text-danger"
            role="alert"
          >
            <span title={error}>failed to send</span>
            <button
              type="button"
              onClick={onRetry}
              className="h-[26px] cursor-pointer rounded border border-danger px-2.5 hover:bg-danger/10 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              retry
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="h-[26px] cursor-pointer px-1.5 text-muted hover:text-fg focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              discard
            </button>
          </span>
        )}
      </div>
      {/* Day 3: the actions toolbar takes this spot on hover, so "sent" only shows without it. */}
      {state === 'sent' && isOwn && !toolbar && (
        <span className="pt-0.5 font-mono text-[11px] text-muted opacity-0 group-hover:opacity-100 max-md:hidden">
          sent
        </span>
      )}
      {toolbar && !editor && (
        // Visible on hover or when focus is inside the row; never on touch layouts (long-press).
        <div className="absolute -top-4 right-3 z-10 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:hidden">
          {toolbar}
        </div>
      )}
    </article>
  );
}
