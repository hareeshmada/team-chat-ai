/**
 * Links in message text (Step 5.2). One definition shared by the server (which link gets a
 * preview job) and the client (which text becomes clickable), so both always agree.
 */

/** `http(s)://` up to whitespace or a character that can't be in a bare URL in chat text. */
export const LINK_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

/** URLs longer than this are left as plain text (and never previewed). */
export const MAX_LINK_LENGTH = 2048;

const TRAILING_PUNCTUATION = /[.,;:!?'"*_~]+$/;

/**
 * Removes punctuation that ends the sentence rather than the URL: "see https://a.dev/x." →
 * "https://a.dev/x". A closing bracket is kept only when the URL also opened one
 * (https://en.wikipedia.org/wiki/Node_(software)).
 */
function trimLink(raw: string): string {
  let url = raw;
  for (;;) {
    const before = url;
    url = url.replace(TRAILING_PUNCTUATION, '');
    for (const [open, close] of [
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
    ] as const) {
      if (url.endsWith(close) && url.split(open).length < url.split(close).length) {
        url = url.slice(0, -1);
      }
    }
    if (url === before) return url;
  }
}

export interface LinkMatch {
  url: string;
  /** Index in the text where the link starts. */
  index: number;
}

/** Every link in `text`, in order, with sentence punctuation trimmed off. */
export function findLinks(text: string): LinkMatch[] {
  const links: LinkMatch[] = [];
  for (const match of text.matchAll(LINK_PATTERN)) {
    const url = trimLink(match[0]);
    // "https://" alone, or absurdly long: not a link we render or fetch.
    if (url.length <= 'https://'.length || url.length > MAX_LINK_LENGTH) continue;
    links.push({ url, index: match.index });
  }
  return links;
}

/** The link that gets a preview card: only the first one in a message (DESIGN rule). */
export function firstLink(text: string): string | null {
  return findLinks(text)[0]?.url ?? null;
}
