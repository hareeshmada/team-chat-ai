import { MENTION_TOKEN } from '@teamchat/shared';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { memberName } from './format';
import { useShell } from './shellContext';

/**
 * A stored body with `<@id>` tokens rendered as mention chips with the member's current name:
 * accent when it's you, info for anyone else (DESIGN §8 "Mention token").
 */
export function MessageBody({ body, meId }: { body: string; meId: string }) {
  const { members } = useShell();
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const id = match[1]!.toLowerCase();
    parts.push(body.slice(last, match.index));
    parts.push(
      <span
        key={match.index}
        className={cn(
          'rounded px-1 font-mono text-[13px]',
          id === meId ? 'bg-accent-soft text-accent-fg' : 'bg-info-soft text-info',
        )}
      >
        @{memberName(members, id)}
      </span>,
    );
    last = match.index + match[0].length;
  }
  parts.push(body.slice(last));
  return <>{parts}</>;
}
