import { LINK_PREVIEW_DESCRIPTION_MAX, LINK_PREVIEW_TITLE_MAX } from '@teamchat/shared';
import { Parser } from 'htmlparser2';

/**
 * Reads a page's preview data from its HTML (Step 5.2): Open Graph tags first (`og:title`,
 * `og:description`, `og:image`), then Twitter cards, then plain `<title>` and
 * `<meta name="description">`.
 *
 * A real HTML parser, not regexes: attributes can come in any order, with single, double or no
 * quotes, and text has entities (`&amp;`, `&#39;`) that must be decoded. htmlparser2 is a
 * forgiving streaming tokenizer: it never throws on broken markup.
 */

export interface PageMeta {
  title: string;
  description?: string;
  imageUrl?: string;
}

/** Collapses whitespace and cuts to `max` characters (with an ellipsis). */
function clean(value: string | undefined, max: number): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Absolute https URL, resolved against the page; anything else (http, data:, javascript:) → none. */
function imageUrl(raw: string | undefined, pageUrl: URL): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(raw.trim(), pageUrl);
    // https only: an http image on our https page would be blocked as mixed content anyway.
    return url.protocol === 'https:' && url.href.length <= 2048 ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Returns null when the page has no title at all (then there's nothing worth a card). */
export function parsePageMeta(html: string, pageUrl: URL): PageMeta | null {
  const meta = new Map<string, string>();
  let titleTag = '';
  let inTitle = false;
  let titleDone = false;
  let inBody = false;

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === 'body') inBody = true;
        // Previews live in <head>; a <meta> in the body is usually user content, so ignore it.
        if (name === 'meta' && !inBody) {
          const key = (attribs.property ?? attribs.name ?? '').toLowerCase().trim();
          // The first value wins (some pages repeat tags).
          if (key && attribs.content !== undefined && !meta.has(key)) {
            meta.set(key, attribs.content);
          }
        }
        if (name === 'title' && !titleDone && !inBody) inTitle = true;
      },
      ontext(text) {
        if (inTitle) titleTag += text;
      },
      onclosetag(name) {
        if (name === 'title' && inTitle) {
          inTitle = false;
          titleDone = true;
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();

  const title = clean(
    meta.get('og:title') ?? meta.get('twitter:title') ?? titleTag,
    LINK_PREVIEW_TITLE_MAX,
  );
  if (!title) return null;
  const description = clean(
    meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'),
    LINK_PREVIEW_DESCRIPTION_MAX,
  );
  const image = imageUrl(
    meta.get('og:image:secure_url') ?? meta.get('og:image') ?? meta.get('twitter:image'),
    pageUrl,
  );
  return { title, ...(description && { description }), ...(image && { imageUrl: image }) };
}
