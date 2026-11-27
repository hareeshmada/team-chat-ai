import { AI_BOT_ID, firstLink, type PublicMessage } from '@teamchat/shared';
import { enqueueLinkPreview } from '../jobs/queues.js';
import { logger } from '../lib/logger.js';

/**
 * After a send or an edit (Step 5.2): if the message's first link has no preview yet, queue the
 * job that fetches one. Fire and forget: the message is already saved and broadcast; if Redis
 * is down it simply gets no card. AI bot answers are never previewed.
 */
export function queueLinkPreview(message: PublicMessage): void {
  if (message.authorId === AI_BOT_ID || message.deletedAt) return;
  const url = firstLink(message.body);
  if (!url || message.linkPreview?.url === url) return;
  enqueueLinkPreview({ messageId: message.id, url }).catch((err: unknown) =>
    // Not the URL: it's user content and could carry tokens in its query string.
    logger.warn({ messageId: message.id, err: (err as Error).message }, 'link preview not queued'),
  );
}
