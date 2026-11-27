import { logger } from '../lib/logger.js';
import { subscribeEvents } from '../lib/pubsub.js';
import { inviteAudience } from '../services/invite.service.js';
import { getPublicMessage } from '../services/message.service.js';
import { notifyInviteUpdated, notifyMessageUpdated } from './realtime.js';

/** Sends an invite's current state to its workspace admins' sockets. */
export async function broadcastInvite(inviteId: string): Promise<void> {
  const found = await inviteAudience(inviteId);
  if (found) notifyInviteUpdated(found.adminIds, found.invite);
}

/** Sends a message's current state (e.g. with its new link preview) to its channel room. */
export async function broadcastMessage(messageId: string): Promise<void> {
  const message = await getPublicMessage(messageId);
  if (message && !message.deletedAt) notifyMessageUpdated(message);
}

/**
 * Relays events the worker publishes (it has no Socket.IO server) to this instance's sockets.
 * Started by server.ts; returns the function that stops it.
 */
export function startEventRelay(): () => Promise<void> {
  return subscribeEvents((event) => {
    if (event.type === 'invite:updated') {
      broadcastInvite(event.inviteId).catch((err: unknown) =>
        logger.error({ err }, 'invite relay failed'),
      );
    } else if (event.type === 'message:updated') {
      broadcastMessage(event.messageId).catch((err: unknown) =>
        logger.error({ err }, 'message relay failed'),
      );
    }
  });
}
