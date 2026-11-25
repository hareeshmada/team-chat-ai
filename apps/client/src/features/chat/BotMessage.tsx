import {
  AI_BOT_NAME,
  AI_LIMIT_REACHED,
  type PublicMessage,
  type ReactionEmoji,
} from '@teamchat/shared';
import { lazy, Suspense, useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { MessageActionsToolbar } from '../../components/ui/MessageActionsToolbar';
import { ReactionPicker } from '../../components/ui/ReactionPicker';
import { StatusDot } from '../../components/ui/StatusDot';
import { cn } from '../../lib/cn';
import { useHighlightStore } from '../../stores/highlight';
import { ActionError, toggleReaction } from './actions';
import { memberName } from './format';
import { MessageRow } from './MessageRow';
import { Reactions } from './Reactions';
import { useShell } from './shellContext';

// Markdown + highlighting load on demand (shared with the assistant panel's chunk); until then
// the answer shows as plain text.
const AiMarkdown = lazy(() =>
  import('../assistant/AiMarkdown').then((m) => ({ default: m.AiMarkdown })),
);

const BOT_AUTHOR = { name: AI_BOT_NAME, colorClass: 'text-accent-fg' };

/**
 * An `@ai` answer from the teamchat-ai bot (Step 4.3): "thinking" → "streaming" (text grows
 * from ai:chunk, with the cursor) → done ("asked by … · based on the last N messages"). Nobody
 * can edit or delete it; reactions work as on any message.
 */
export function BotMessage({ message, meId }: { message: PublicMessage; meId: string }) {
  const { members } = useShell();
  const highlighted = useHighlightStore((s) => s.messageId === message.id);
  const [picking, setPicking] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const reactRef = useRef<HTMLButtonElement>(null);
  const ai = message.ai!;
  const status = ai.status;

  const react = (emoji: ReactionEmoji) => {
    setActionError(undefined);
    toggleReaction(message, emoji).catch((err: unknown) =>
      setActionError(err instanceof ActionError ? err.message : 'Something went wrong'),
    );
  };

  const body =
    status === 'thinking' ? (
      <div role="status" className="flex flex-col gap-1.5">
        <span className="sr-only">{AI_BOT_NAME} is reading the channel</span>
        <span aria-hidden="true" className="h-2.5 w-[70%] rounded-[3px] bg-surface-2" />
      </div>
    ) : (
      <Suspense fallback={<p className="break-words whitespace-pre-wrap">{message.body}</p>}>
        <AiMarkdown text={message.body} streaming={status === 'streaming'} />
      </Suspense>
    );

  const authorExtra = (
    <>
      <Badge>bot</Badge>
      {status === 'thinking' && (
        <span className="font-mono text-[11px] text-muted">reading the last 30 messages…</span>
      )}
      {status === 'streaming' && (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent-fg">
          <StatusDot status="live" /> streaming
        </span>
      )}
    </>
  );

  const asker = ai.askedById === meId ? 'you' : memberName(members, ai.askedById);

  return (
    <MessageRow
      createdAt={message.createdAt}
      body={body}
      richBody
      author={BOT_AUTHOR}
      authorExtra={authorExtra}
      busy={status !== 'done'}
      footer={
        status === 'done'
          ? `asked by ${asker} · based on the last ${ai.contextCount} ${ai.contextCount === 1 ? 'message' : 'messages'}`
          : undefined
      }
      actionError={actionError}
      highlighted={highlighted}
      rowProps={{ id: `message-${message.id}` }}
      reactions={
        status === 'done' ? <Reactions message={message} meId={meId} onToggle={react} /> : undefined
      }
      toolbar={
        status === 'done' ? (
          <div className="relative">
            <MessageActionsToolbar
              reactRef={reactRef}
              onReact={() => setPicking((open) => !open)}
            />
            {picking && (
              <ReactionPicker
                triggerRef={reactRef}
                onPick={react}
                onClose={() => setPicking(false)}
                className="absolute right-0 bottom-full mb-1"
              />
            )}
          </div>
        ) : undefined
      }
    />
  );
}

/**
 * Under YOUR `@ai` question when its answer failed (or couldn't start): only you see it, and
 * retry asks again. At the daily limit (Step 4.4) there's nothing to retry until the reset.
 */
export function AiFailedRow({
  questionId,
  error,
  onRetry,
}: {
  questionId: string;
  error: { code: string; message: string };
  onRetry: (questionId: string) => void;
}) {
  const limit = error.code === AI_LIMIT_REACHED;
  return (
    <article
      className={cn(
        'grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-md px-2 py-2 max-md:grid-cols-[minmax(0,1fr)] max-md:px-1',
        limit ? 'bg-warning/8' : 'bg-danger/8',
      )}
    >
      <span aria-hidden="true" className="max-md:hidden" />
      <div className="flex flex-col gap-1.5" role="alert">
        {limit ? (
          <span className="text-[13px]">
            Your daily AI allowance is used up. It resets at midnight.
          </span>
        ) : (
          <>
            <span className="font-semibold text-accent-fg">{AI_BOT_NAME}</span>
            <span className="flex flex-wrap items-center gap-2.5 text-[13px]">
              {error.code === 'AI_BUSY' ? error.message : 'Couldn’t finish this answer.'}
              <button
                type="button"
                onClick={() => onRetry(questionId)}
                className="h-7 cursor-pointer rounded border border-danger px-2.5 font-mono text-xs text-danger hover:bg-danger/10 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
              >
                retry
              </button>
            </span>
          </>
        )}
        <span className="font-mono text-[11px] text-muted">
          {limit ? 'only visible to you · your message was still sent' : 'only visible to you'}
        </span>
      </div>
    </article>
  );
}
