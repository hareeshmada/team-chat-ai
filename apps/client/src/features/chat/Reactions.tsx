import { REACTION_LABELS, type PublicMessage, type ReactionEmoji } from '@teamchat/shared';
import { SmilePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { ReactionPicker } from '../../components/ui/ReactionPicker';
import { ReactionPill } from '../../components/ui/ReactionPill';
import { reactedWithText } from './reactionText';
import { useShell } from './shellContext';

/** Pills under a message + the dashed "add reaction" button (only when there are reactions). */
export function Reactions({
  message,
  meId,
  onToggle,
}: {
  message: PublicMessage;
  meId: string;
  onToggle: (emoji: ReactionEmoji) => void;
}) {
  const { members } = useShell();
  const [picking, setPicking] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  if (message.reactions.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {message.reactions.map((r) => (
        <ReactionPill
          key={r.emoji}
          emoji={r.emoji}
          label={REACTION_LABELS[r.emoji]}
          count={r.userIds.length}
          reacted={r.userIds.includes(meId)}
          who={reactedWithText(r, members, meId)}
          onClick={() => onToggle(r.emoji)}
        />
      ))}
      <span className="relative inline-flex">
        <button
          ref={addRef}
          type="button"
          aria-label="Add reaction"
          aria-haspopup="menu"
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
          className="inline-flex h-[26px] w-[30px] cursor-pointer items-center justify-center rounded-md border border-dashed border-border-strong text-muted hover:text-fg focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          <SmilePlus size={14} aria-hidden />
        </button>
        {picking && (
          <ReactionPicker
            triggerRef={addRef}
            onPick={onToggle}
            onClose={() => setPicking(false)}
            className="absolute bottom-full left-0 mb-1"
          />
        )}
      </span>
    </div>
  );
}
