import { createHash, randomBytes } from 'node:crypto';

/**
 * Short-lived, single-use tickets for the SSE stream. EventSource can't send an Authorization
 * header, and putting the JWT itself in the URL would leak a 15-minute credential into logs,
 * browser history and proxies. A ticket is useless after one connect or 60 s.
 *
 * Kept in this process's memory (hashed, like refresh tokens). With several server instances a
 * ticket issued by one must work on another: Day 5 moves this to Redis (SET ticket EX 60, GETDEL).
 */
export const TICKET_TTL_MS = 60_000;

const tickets = new Map<string, { userId: string; expiresAt: number }>();
const hash = (ticket: string) => createHash('sha256').update(ticket).digest('hex');

export function issueTicket(userId: string): { ticket: string; expiresAt: Date } {
  sweep();
  const ticket = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + TICKET_TTL_MS;
  tickets.set(hash(ticket), { userId, expiresAt });
  return { ticket, expiresAt: new Date(expiresAt) };
}

/** The user id if the ticket is valid; the ticket is deleted either way (single use). */
export function consumeTicket(ticket: string): string | null {
  const key = hash(ticket);
  const entry = tickets.get(key);
  tickets.delete(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.userId;
}

/** Drop expired tickets (run on every issue, so the map can't grow without bound). */
function sweep() {
  const now = Date.now();
  for (const [key, entry] of tickets) if (entry.expiresAt <= now) tickets.delete(key);
}
