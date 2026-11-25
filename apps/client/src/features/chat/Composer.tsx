import {
  AI_BOT_ID,
  isAiQuestion,
  MESSAGE_BODY_MAX,
  type PublicChannel,
  type WorkspaceMember,
} from '@teamchat/shared';
import { SendHorizontal, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useTypingEmitter } from './hooks';
import { MentionAutocomplete } from './MentionAutocomplete';
import { fromEditable, mentionQueryAt, type PickedMention } from './mentionText';
import { sendMessage } from './send';
import { useShell } from './shellContext';

const MAX_HEIGHT_PX = 160;
const MAX_OPTIONS = 8;

/** "@ai" in the autocomplete (only at the start of a message, where it asks the bot). */
const AI_OPTION: WorkspaceMember = {
  userId: AI_BOT_ID,
  name: 'ai',
  email: 'ask the assistant in this channel',
  avatarUrl: null,
  role: 'member',
  joinedAt: new Date(0).toISOString(),
};

/**
 * Enter sends, Shift+Enter adds a line. Usable offline: messages queue as "sending…".
 * "@" opens the member autocomplete; a picked "@Name" is sent as a <@userId> token.
 */
export function Composer({ channel }: { channel: PublicChannel }) {
  const { members, online } = useShell();
  const meId = useAuthStore((s) => s.user?.id);
  const [body, setBody] = useState('');
  const [caret, setCaret] = useState(0);
  const [picked, setPicked] = useState<PickedMention[]>([]);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const nextCaret = useRef<number | null>(null);
  const listId = useId();
  const { onType, stop } = useTypingEmitter(channel.id);
  const canSend = body.trim().length > 0;
  // "@ai …": the bot will answer in the channel, so say so (public answer, uses your allowance).
  const asksAi = isAiQuestion(body);

  // Who can be mentioned here: people who can see the channel (not you), online first.
  const candidates = useMemo(() => {
    const visible = (members ?? []).filter(
      (m) => m.userId !== meId && (!channel.isPrivate || channel.memberIds.includes(m.userId)),
    );
    return visible.sort(
      (a, b) =>
        Number(online.has(b.userId)) - Number(online.has(a.userId)) || a.name.localeCompare(b.name),
    );
  }, [members, meId, channel, online]);

  const mention = mentionQueryAt(body, caret);
  const options = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const people = candidates.filter((m) =>
      m.name
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.startsWith(q)),
    );
    const offerAi = body.slice(0, mention.start).trim() === '' && 'ai'.startsWith(q);
    return (offerAi ? [AI_OPTION, ...people] : people).slice(0, MAX_OPTIONS);
  }, [mention, candidates, body]);
  const open = mention !== null && options.length > 0 && dismissedAt !== mention.start;
  const activeIndex = Math.min(active, options.length - 1);

  // Grow with the text up to MAX_HEIGHT_PX, then scroll inside; put the caret after a pick.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    if (nextCaret.current !== null) {
      el.setSelectionRange(nextCaret.current, nextCaret.current);
      nextCaret.current = null;
    }
  }, [body]);

  // Mounted per channel (keyed): put the cursor in the box.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  function pick(member: WorkspaceMember) {
    if (!mention) return;
    const inserted = `@${member.name} `;
    const isBot = member.userId === AI_BOT_ID;
    const next = body.slice(0, mention.start) + inserted + body.slice(caret);
    const at = mention.start + inserted.length;
    nextCaret.current = at;
    setBody(next);
    setCaret(at);
    setActive(0);
    // "@ai" stays plain text (the server recognises it); people become <@id> tokens.
    if (isBot) return;
    setPicked((list) =>
      list.some((p) => p.userId === member.userId)
        ? list
        : [...list, { userId: member.userId, name: member.name }],
    );
  }

  function send() {
    const text = body.trim();
    if (!text) return;
    sendMessage(channel.id, fromEditable(text, picked));
    setBody('');
    setCaret(0);
    setPicked([]);
    stop();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="px-5 pb-4 max-md:border-t max-md:border-border max-md:bg-surface max-md:px-2.5 max-md:pt-2 max-md:pb-3.5"
    >
      {asksAi && (
        <p
          id={`${listId}-ai-hint`}
          className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] text-accent-fg"
        >
          <Sparkles size={12} aria-hidden />
          the answer will be visible to everyone in #{channel.name} · uses your AI allowance
        </p>
      )}
      <div
        className={cn(
          'relative flex items-end gap-2 rounded-lg border bg-surface p-1.5 pl-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-focus-ring max-md:bg-field',
          asksAi ? 'border-accent' : 'border-border-strong',
        )}
      >
        {open && mention && (
          <MentionAutocomplete
            id={listId}
            query={mention.query}
            options={options}
            active={activeIndex}
            online={online}
            onPick={pick}
            onHover={setActive}
          />
        )}
        <span aria-hidden="true" className="self-center font-mono text-accent-fg max-md:hidden">
          ›
        </span>
        <label htmlFor="composer" className="sr-only">
          Message #{channel.name}
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={body}
          maxLength={MESSAGE_BODY_MAX}
          placeholder={`message #${channel.name} · @ai to ask in channel`}
          aria-describedby={asksAi ? `${listId}-ai-hint` : undefined}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          onChange={(e) => {
            setBody(e.target.value);
            setCaret(e.target.selectionStart);
            setActive(0);
            if (e.target.value.trim()) onType();
            else stop();
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (open) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                setActive((activeIndex + step + options.length) % options.length);
                return;
              }
              if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) {
                e.preventDefault();
                pick(options[activeIndex]!);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setDismissedAt(mention?.start ?? null);
                return;
              }
            }
            // isComposing: Enter that confirms an IME candidate (e.g. Japanese input) is not "send".
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 font-mono text-[13px] leading-5 outline-none placeholder:text-muted max-md:text-sm"
        />
        <span className="self-center font-mono text-[11px] whitespace-nowrap text-muted max-lg:hidden">
          shift ↵ new line
        </span>
        <button
          type="submit"
          disabled={!canSend}
          aria-label={asksAi ? 'Ask the AI in this channel' : 'Send message'}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none max-md:size-11 max-md:rounded-lg max-md:px-0"
        >
          <span className="max-md:hidden" aria-hidden="true">
            {asksAi ? 'Ask ↵' : 'Send ↵'}
          </span>
          <SendHorizontal size={18} aria-hidden className="md:hidden" />
        </button>
      </div>
    </form>
  );
}
