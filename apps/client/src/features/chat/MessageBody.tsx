import { findLinks, MENTION_TOKEN } from '@teamchat/shared';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { memberName } from './format';
import { useShell } from './shellContext';

/** Plain text with its `http(s)://` links made clickable (Step 5.2; shared link rules). */
function withLinks(text: string, keyPrefix: number): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const { url, index } of findLinks(text)) {
    parts.push(text.slice(last, index));
    parts.push(
      <a
        key={`${keyPrefix}-${index}`}
        href={url}
        target="_blank"
        // noopener: the page can't reach back into this tab; nofollow: user content.
        rel="noopener noreferrer nofollow"
        className="break-all text-accent-fg underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {url}
      </a>,
    );
    last = index + url.length;
  }
  parts.push(text.slice(last));
  return parts;
}

/**
 * A stored body with `<@id>` tokens rendered as mention chips with the member's current name
 * (accent when it's you, info for anyone else; DESIGN §8 "Mention token") and links clickable.
 */
export function MessageBody({ body, meId }: { body: string; meId: string }) {
  const { members } = useShell();
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const id = match[1]!.toLowerCase();
    parts.push(...withLinks(body.slice(last, match.index), last));
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
  parts.push(...withLinks(body.slice(last), last));
  return <>{parts}</>;
}
