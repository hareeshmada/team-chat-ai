import { cn } from '../../lib/cn';
import { formatTime } from './format';

export type MessageState = 'sent' | 'sending' | 'failed';

export interface MessageRowProps {
  createdAt: string;
  body: string;
  /** Hidden for a follow-up from the same author (compact row). */
  author?: { name: string; colorClass: string };
  state?: MessageState;
  /** Your own delivered messages show "sent" on hover. */
  isOwn?: boolean;
  error?: string;
  onRetry?: () => void;
  onDiscard?: () => void;
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
}: MessageRowProps) {
  const time = formatTime(createdAt);
  return (
    <article
      className={cn(
        'group grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 rounded-md px-2 max-md:grid-cols-[minmax(0,1fr)] max-md:gap-0.5 max-md:px-1',
        author ? 'py-1.5' : 'py-0.5',
        state === 'failed' && 'bg-danger/8 py-1.5',
      )}
    >
      <time dateTime={createdAt} className="pt-0.5 font-mono text-xs text-muted max-md:hidden">
        {time}
      </time>
      <div className="flex min-w-0 flex-col gap-0.5">
        {author && (
          <span className="flex items-baseline gap-2">
            <span className={cn('font-semibold', author.colorClass)}>{author.name}</span>
            <time dateTime={createdAt} className="font-mono text-[11px] text-muted md:hidden">
              {time}
            </time>
          </span>
        )}
        <p className={cn('break-words whitespace-pre-wrap', state === 'sending' && 'text-muted')}>
          {body}
        </p>
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
      {state === 'sent' && isOwn && (
        <span className="pt-0.5 font-mono text-[11px] text-muted opacity-0 group-hover:opacity-100 max-md:hidden">
          sent
        </span>
      )}
    </article>
  );
}
