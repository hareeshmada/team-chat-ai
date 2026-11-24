import {
  markNotificationsReadSchema,
  notificationsQuerySchema,
  notificationStreamQuerySchema,
} from '@teamchat/shared';
import { Router } from 'express';
import * as notifications from '../controllers/notification.controller.js';
import { createWriteRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';

export const notificationRouter = Router();

// The stream authenticates with its single-use ?ticket= (EventSource can't send headers), so it
// is mounted BEFORE requireAuth.
notificationRouter.get(
  '/stream',
  validate({ query: notificationStreamQuerySchema }),
  notifications.stream,
);

notificationRouter.use(requireAuth);

// A reconnect loop must not mint tickets without limit: 10 per minute per user.
const ticketLimit = createWriteRateLimiter({ limit: 10 });
notificationRouter.post('/stream-ticket', ticketLimit, notifications.createTicket);
notificationRouter.get('/', validate({ query: notificationsQuerySchema }), notifications.list);
notificationRouter.post(
  '/read',
  validate({ body: markNotificationsReadSchema }),
  notifications.markRead,
);
