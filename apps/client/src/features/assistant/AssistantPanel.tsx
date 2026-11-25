import { ArrowLeft, History, Plus, SendHorizontal, Square, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { useParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusDot } from '../../components/ui/StatusDot';
import { cn } from '../../lib/cn';
import { assistantBusy, useAssistantStore, type ChatMessage } from '../../stores/assistant';
import { useChannels } from '../chat/queries';
import { useShell } from '../chat/shellContext';
import {
  ask,
  newConversation,
  openConversation,
  rememberedConversation,
  retry,
  stop,
} from './actions';
import { AiErrorCard } from './AiErrorCard';
import { AiMarkdown } from './AiMarkdown';
import { ConversationList } from './ConversationList';
import { EmptyAssistant } from './EmptyAssistant';
import { LimitCard } from './LimitCard';
import { ThinkingPlaceholder } from './ThinkingPlaceholder';
import { formatTokens, isOverLimit, useAiUsage } from './usage';
import { formatTime } from '../chat/format';

const NEAR_BOTTOM_PX = 80;

/**
 * The AI assistant: a 340px column beside the channel (≥ 768px) or a full screen (< 768px).
 * Lazy-loaded (default export) so markdown + highlighting only download when it is first opened.
 */
export default function AssistantPanel() {
  const s = useAssistantStore();
  const busy = assistantBusy(s.status);
  const channelName = useOpenChannelName();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: usage } = useAiUsage();
  const overLimit = isOverLimit(usage) && !busy;
  const nearBottom = useRef(true);

  // First open after a reload: bring back the conversation you were in.
  useEffect(() => {
    const { conversationId, messages } = useAssistantStore.getState();
    const remembered = rememberedConversation();
    if (!conversationId && messages.length === 0 && remembered) void openConversation(remembered);
  }, []);

  // Follow the answer as it grows, unless the user scrolled up to read something.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [s.messages, s.status, s.failure, s.view, overLimit]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const send = (text: string) => {
    nearBottom.current = true; // your own question always scrolls into view
    void ask(text);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && busy) {
      e.preventDefault();
      e.stopPropagation();
      stop();
    }
  };

  const close = () => s.setOpen(false);
  const last = s.messages.at(-1);

  return (
    <aside
      aria-label="Assistant"
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-col bg-panel max-md:fixed max-md:inset-0 max-md:z-30 md:w-[340px] md:shrink-0 md:border-l md:border-border"
    >
      {s.view === 'history' ? (
        <>
          <header className="flex min-h-14 items-center gap-1 border-b border-border px-2 max-md:min-h-14">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              onClick={() => s.setView('chat')}
              className="size-8 max-md:size-11"
            >
              <ArrowLeft size={16} aria-hidden />
            </Button>
            <h2 className="m-0 flex-1 font-mono text-[13px] font-semibold">past conversations</h2>
            <Button variant="secondary" size="sm" onClick={newConversation}>
              New
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              currentId={s.conversationId}
              onOpen={(id) => void openConversation(id)}
            />
          </div>
        </>
      ) : (
        <>
          <header className="flex min-h-14 items-center gap-0.5 border-b border-border py-2 pr-2 pl-4 max-md:pl-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={channelName ? `Back to #${channelName}` : 'Close assistant'}
              onClick={close}
              className="size-11 text-fg md:hidden"
            >
              <ArrowLeft size={20} aria-hidden />
            </Button>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <h2 className="m-0 font-mono text-[13px] font-semibold max-md:text-[15px]">
                assistant
              </h2>
              {/* Mobile: the stream status sits under the title (the footer has no room). */}
              {busy ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent-fg md:hidden">
                  <StatusDot status="live" /> {s.status === 'waiting' ? 'thinking' : 'streaming'}
                </span>
              ) : null}
              {s.title && (
                <span className="truncate text-xs text-muted max-md:hidden">{s.title}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Past conversations"
              onClick={() => s.setView('history')}
              className="size-8 max-md:size-11 max-md:text-fg"
            >
              <History size={16} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="New conversation"
              onClick={newConversation}
              className="size-8 max-md:size-11 max-md:text-fg"
            >
              <Plus size={16} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close assistant"
              onClick={close}
              className="size-8 max-md:hidden"
            >
              <X size={16} aria-hidden />
            </Button>
          </header>

          <div
            ref={scrollerRef}
            onScroll={onScroll}
            aria-live="polite"
            aria-busy={busy || s.status === 'loading'}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className="flex min-h-full flex-col justify-end gap-3.5 p-4 text-[13px] leading-[1.6]">
              {s.status === 'loading' ? (
                <LoadingConversation />
              ) : s.messages.length === 0 && !busy ? (
                overLimit ? null : (
                  <EmptyAssistant onPick={s.setDraft} />
                )
              ) : (
                s.messages.map((m) => (
                  <Message
                    key={m.key}
                    message={m}
                    streaming={s.status === 'streaming' && m === last && m.role === 'assistant'}
                  />
                ))
              )}
              {s.status === 'waiting' && <ThinkingPlaceholder />}
              {overLimit && usage && <LimitCard usage={usage} />}
              {s.failure && (
                <AiErrorCard
                  title={s.failure.title}
                  detail={s.failure.detail}
                  onRetry={retry}
                  onCopyPartial={
                    s.failure.kind === 'cut' && last?.role === 'assistant'
                      ? () => void navigator.clipboard?.writeText(last.content).catch(() => {})
                      : undefined
                  }
                />
              )}
            </div>
          </div>

          <AskBox busy={busy} disabled={s.status === 'loading'} onSend={send} />
        </>
      )}
    </aside>
  );
}

function Message({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="max-w-[88%] self-end rounded-lg bg-surface-2 px-3 py-2 break-words whitespace-pre-wrap max-md:rounded-[10px] max-md:px-3.5 max-md:py-2.5">
        {message.content}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <AiMarkdown text={message.content} streaming={streaming} />
      {message.stopped && <span className="font-mono text-[11px] text-muted">stopped</span>}
    </div>
  );
}

function LoadingConversation() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading conversation">
      <Skeleton className="h-8 w-2/3 self-end" />
      <Skeleton tone="secondary" className="h-2.5 w-[90%]" />
      <Skeleton tone="secondary" className="h-2.5 w-[70%]" />
    </div>
  );
}

/** Footer: stream status row + the ask box (Send ↔ Stop). */
function AskBox({
  busy,
  disabled,
  onSend,
}: {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const draft = useAssistantStore((s) => s.draft);
  const setDraft = useAssistantStore((s) => s.setDraft);
  const status = useAssistantStore((s) => s.status);
  const tokensPerSecond = useAssistantStore((s) => s.tokensPerSecond);
  const { data: usage } = useAiUsage();
  const overLimit = isOverLimit(usage) && !busy;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const hadFocus = useRef(false);

  // The textarea is disabled while busy, so move focus to Stop (Esc / Enter work from there),
  // and back to the textarea when the answer ends.
  useEffect(() => {
    if (busy) {
      if (hadFocus.current) stopRef.current?.focus();
    } else if (hadFocus.current) {
      inputRef.current?.focus();
    }
  }, [busy]);

  // A suggestion (or a question taken back after Stop) lands in the box: focus it.
  useEffect(() => {
    if (draft) inputRef.current?.focus();
  }, [draft]);

  // Grow with the text, up to ~6 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight leaves out the border; add it back or a scrollbar appears.
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + border, 140)}px`;
  }, [draft]);

  const submit = () => {
    if (!draft.trim() || busy || disabled) return;
    hadFocus.current = true;
    onSend(draft);
  };

  return (
    <div
      className="flex flex-col gap-2.5 border-t border-border px-4 pt-3 pb-3.5 max-md:bg-surface max-md:px-3"
      onFocus={() => (hadFocus.current = true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hadFocus.current = false;
      }}
    >
      {(busy || (usage && !usage.degraded)) && (
        <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 text-accent-fg max-md:hidden">
              <StatusDot status="live" />
              {status === 'waiting'
                ? 'waiting for the first token'
                : `streaming${tokensPerSecond ? ` · ~${tokensPerSecond} tok/s` : ''}`}
            </span>
          ) : (
            <span />
          )}
          {usage && !usage.degraded && (
            <span>
              today {formatTokens(usage.used)} / {formatTokens(usage.limit)}
            </span>
          )}
        </div>
      )}

      {busy ? (
        <>
          <div className="flex items-end gap-2 max-md:hidden">
            <label htmlFor="ai-ask" className="sr-only">
              Ask the assistant
            </label>
            {/* A one-line stand-in while busy (a textarea would wrap the placeholder). */}
            <input
              id="ai-ask"
              disabled
              placeholder="wait for the answer or press stop"
              className="h-10 min-w-0 flex-1 truncate rounded-lg border border-border bg-surface px-3 font-mono text-[13px] placeholder:text-subtle"
            />
            <button
              ref={stopRef}
              type="button"
              onClick={stop}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 font-mono text-xs text-fg hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              <Square size={10} fill="currentColor" aria-hidden /> stop · esc
            </button>
          </div>
          <button
            type="button"
            onClick={stop}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-border-strong bg-bg font-mono text-[13px] text-fg md:hidden"
          >
            <Square size={10} fill="currentColor" aria-hidden /> stop generating
          </button>
        </>
      ) : overLimit && usage ? (
        // At the daily limit: no sending until the reset (channel chat keeps working).
        <input
          aria-label="Ask the assistant"
          disabled
          placeholder={`available again at ${formatTime(usage.resetAt)}`}
          className="h-10 min-w-0 truncate rounded-lg border border-border bg-surface px-3 font-mono text-[13px] placeholder:text-subtle"
        />
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="ai-ask" className="sr-only">
            Ask the assistant
          </label>
          <textarea
            id="ai-ask"
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={disabled}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter = new line (not while an IME is composing).
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="ask anything…"
            className={cn(
              'min-h-10 min-w-0 flex-1 resize-none rounded-lg border border-border-strong bg-field px-3 py-2.5 font-mono text-[13px] text-fg placeholder:text-subtle',
              'focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
            )}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send"
            disabled={!draft.trim() || disabled}
            className="size-10 rounded-lg"
          >
            <SendHorizontal size={16} aria-hidden />
          </Button>
        </form>
      )}
    </div>
  );
}

/** The open channel's name, for the mobile "Back to #channel" button. */
function useOpenChannelName(): string | undefined {
  const { workspace } = useShell();
  const { channelId } = useParams();
  const { data: channels } = useChannels(workspace.id);
  return channels?.find((c) => c.id === channelId)?.name;
}
