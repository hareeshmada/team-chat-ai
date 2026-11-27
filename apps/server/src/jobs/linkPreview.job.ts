import { firstLink } from '@teamchat/shared';
import { UnrecoverableError } from 'bullmq';
import { parsePageMeta } from '../lib/htmlMeta.js';
import { publishEvent } from '../lib/pubsub.js';
import { FetchError, safeFetchHtml } from '../lib/safeFetch.js';
import { Message } from '../models/Message.js';
import type { LinkPreviewJobData } from './queues.js';

/**
 * The `link-preview` job (runs in the worker). Fetches the page behind a message's first link
 * (through the SSRF-safe fetcher), saves title/description/image on the message, and publishes
 * `message:updated` so the API sends it to the channel and the card appears live.
 *
 * Safe to run more than once: it re-reads the message every time and only writes if the message
 * still exists, isn't deleted and still has this link first (an edit meanwhile → its own job).
 * The write is conditional on the body it checked, so an edit that lands during the fetch wins.
 */

export interface LinkPreviewJobDeps {
  fetchPage?: typeof safeFetchHtml;
  publish?: typeof publishEvent;
}

export type LinkPreviewJobResult = 'saved' | 'already-saved' | 'no-preview' | 'stale';

export async function processLinkPreview(
  { messageId, url }: LinkPreviewJobData,
  { fetchPage = safeFetchHtml, publish = publishEvent }: LinkPreviewJobDeps = {},
): Promise<LinkPreviewJobResult> {
  const message = await Message.findById(messageId).lean();
  if (!message || message.deletedAt || firstLink(message.body) !== url) return 'stale';
  if (message.linkPreview?.url === url) return 'already-saved';

  let page;
  try {
    page = await fetchPage(url);
  } catch (err) {
    // A 404, a blocked address or a PDF won't change in 3 s: tell BullMQ not to retry.
    if (err instanceof FetchError && !err.retryable) throw new UnrecoverableError(err.message);
    throw err;
  }

  const meta = parsePageMeta(page.html, page.url);
  if (!meta) return 'no-preview'; // no title: nothing worth a card

  const res = await Message.updateOne(
    { _id: messageId, deletedAt: null, body: message.body },
    {
      $set: {
        linkPreview: { url, domain: page.url.hostname.replace(/^www\./, ''), ...meta },
      },
    },
  );
  if (res.modifiedCount === 0) return 'stale';
  await publish({ type: 'message:updated', messageId });
  return 'saved';
}
