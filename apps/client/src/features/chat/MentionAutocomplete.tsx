import { AI_BOT_ID, type WorkspaceMember } from '@teamchat/shared';
import { Sparkles } from 'lucide-react';
import { StatusDot } from '../../components/ui/StatusDot';
import { cn } from '../../lib/cn';

/**
 * The member list that opens above the composer on "@" (DESIGN §8 MentionAutocomplete).
 * Presentational: the composer owns the keyboard (the textarea keeps focus; this list is
 * linked to it with aria-controls / aria-activedescendant).
 */
export function MentionAutocomplete({
  id,
  query,
  options,
  active,
  online,
  onPick,
  onHover,
}: {
  id: string;
  query: string;
  options: WorkspaceMember[];
  active: number;
  online: Set<string>;
  onPick: (member: WorkspaceMember) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div className="absolute bottom-full left-0 z-30 mb-1.5 flex w-[320px] max-w-full flex-col rounded-[10px] border border-border-strong bg-surface p-1 shadow-float">
      <span className="px-2.5 pt-1.5 pb-1 font-mono text-[11px] text-muted">
        {query ? `members matching “${query}”` : 'members'}
      </span>
      <div id={id} role="listbox" aria-label="Mention a member" className="flex flex-col">
        {options.map((m, i) => (
          <div
            key={m.userId}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === active}
            // mousedown, not click: picking must not blur the textarea first.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(m);
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              'flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2.5',
              i === active && 'bg-surface-2',
            )}
          >
            {m.userId === AI_BOT_ID ? (
              <Sparkles size={12} aria-hidden className="shrink-0 text-accent-fg" />
            ) : (
              <StatusDot
                status={online.has(m.userId) ? 'online' : 'offline'}
                className="size-[7px] shrink-0"
              />
            )}
            <span className="truncate font-mono font-semibold">{m.name}</span>
            <span className="truncate text-[13px] text-muted">{m.email}</span>
          </div>
        ))}
      </div>
      <span className="px-2.5 pt-1 pb-1.5 font-mono text-[11px] text-muted">
        ↑↓ move · ↵ or tab select · esc close
      </span>
    </div>
  );
}
