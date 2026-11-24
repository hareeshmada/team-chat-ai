import {
  extractMentionIds,
  MENTION_TOKEN,
  mentionToken,
  type WorkspaceMember,
} from '@teamchat/shared';
import { memberName } from './format';

/** Someone picked in the autocomplete (or already mentioned in a message being edited). */
export interface PickedMention {
  userId: string;
  name: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Stored body → what a person reads or edits: `<@id>` becomes "@Karthik S". */
export function toEditable(body: string, members: WorkspaceMember[] | undefined): string {
  return body.replace(MENTION_TOKEN, (_, id: string) => `@${memberName(members, id)}`);
}

/**
 * Text from the composer/editor → stored body: each "@Name" of a picked person becomes
 * `<@id>`. Only picked names convert, so typing "@someone" by hand stays plain text. Longest
 * names first, so "@Ann Lee" isn't eaten by a shorter "@Ann".
 */
export function fromEditable(text: string, picked: PickedMention[]): string {
  return [...picked]
    .sort((a, b) => b.name.length - a.name.length)
    .reduce(
      (out, p) =>
        out.replace(
          new RegExp(`@${escapeRegExp(p.name)}(?![\\p{L}\\p{N}_])`, 'gu'),
          mentionToken(p.userId),
        ),
      text,
    );
}

/** The people already mentioned in a stored body (to keep them when it's edited). */
export function mentionsIn(body: string, members: WorkspaceMember[] | undefined): PickedMention[] {
  return extractMentionIds(body).map((userId) => ({ userId, name: memberName(members, userId) }));
}

/** The text before the caret ends in "@query" (start of text or after a space)? */
export function mentionQueryAt(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const match = /(?:^|\s)@([^\s@]{0,30})$/u.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[1]!.length - 1, query: match[1]! };
}
