import type { Reaction, WorkspaceMember } from '@teamchat/shared';
import { memberName } from './format';

/** "priya, arjun and you reacted with 👍" (you last, like the reference). */
export function reactedWithText(
  reaction: Reaction,
  members: WorkspaceMember[] | undefined,
  meId: string,
): string {
  const others = reaction.userIds.filter((id) => id !== meId).map((id) => memberName(members, id));
  const names = reaction.userIds.includes(meId) ? [...others, 'you'] : others;
  const list =
    names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list} reacted with ${reaction.emoji}`;
}
