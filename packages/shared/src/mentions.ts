/**
 * Mentions are stored in the message body as `<@userId>` tokens (the composer turns a picked
 * "@Karthik S" into one). Ids, not names: names aren't unique and can change; the UI renders
 * each token with the member's current name.
 */
export const MENTION_TOKEN = /<@([a-f\d]{24})>/gi;

/** Unique user ids mentioned in a body, in order of first appearance. */
export function extractMentionIds(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION_TOKEN)].map((m) => m[1]!.toLowerCase()))];
}

export const mentionToken = (userId: string) => `<@${userId}>`;
