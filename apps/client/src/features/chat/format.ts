import type { PublicChannel, WorkspaceMember } from '@teamchat/shared';

// Literal class names (Tailwind only generates classes it can find written out in the source).
const AUTHOR_COLORS = [
  'text-author-1',
  'text-author-2',
  'text-author-3',
  'text-author-4',
  'text-author-5',
] as const;

/** A stable color per user: the same person always gets the same of the five author colors. */
export function authorColor(userId: string): string {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AUTHOR_COLORS[hash % AUTHOR_COLORS.length]!;
}

export function memberName(members: WorkspaceMember[] | undefined, userId: string): string {
  return members?.find((m) => m.userId === userId)?.name ?? 'unknown';
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "10:02" */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** "18 Nov 2026" */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export const dayKey = (iso: string) => new Date(iso).toDateString();

/** Day divider text: "today", "yesterday" or "Mon, 18 Nov". */
export function dayLabel(iso: string): string {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'today';
  if (day.toDateString() === yesterday.toDateString()) return 'yesterday';
  return dayFormat.format(day);
}

/** Messages from the same author within this window are grouped (no repeated author line). */
export const GROUP_WINDOW_MS = 5 * 60_000;

export function typingLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'several people are typing…';
}

/** "Created by you just now." / "Created by priya on 18 Nov 2026." */
export function createdByText(
  channel: PublicChannel,
  members: WorkspaceMember[] | undefined,
  meId: string | undefined,
): string {
  const who = channel.createdBy === meId ? 'you' : memberName(members, channel.createdBy);
  const justNow = Date.now() - new Date(channel.createdAt).getTime() < 60_000;
  return `Created by ${who} ${justNow ? 'just now' : `on ${formatDate(channel.createdAt)}`}.`;
}
