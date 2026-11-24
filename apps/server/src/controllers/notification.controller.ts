import type { MarkNotificationsReadInput, NotificationsQuery } from '@teamchat/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import * as notificationService from '../services/notification.service.js';
import { consumeTicket, issueTicket } from '../services/streamTicket.service.js';
import { openStreamCount, runNotificationStream, sseConfig } from '../sse/notificationStream.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

export const createTicket: RequestHandler = (req, res) => {
  const { ticket, expiresAt } = issueTicket(getAuthUser(req).userId);
  res.status(201).json({ ticket, expiresAt: expiresAt.toISOString() });
};

export const stream: RequestHandler = async (req, res) => {
  const { ticket, lastEventId: fromQuery } = req.query as unknown as {
    ticket: string;
    lastEventId?: string;
  };
  // Checked before any stream headers are sent, so failures are normal JSON errors.
  const userId = consumeTicket(ticket);
  if (!userId) throw new AppError(401, 'INVALID_TICKET', 'Stream ticket is invalid or expired');
  if (openStreamCount(userId) >= sseConfig.maxStreamsPerUser) {
    throw new AppError(429, 'TOO_MANY_STREAMS', 'Too many open notification streams');
  }

  // The browser's automatic reconnect sends the Last-Event-ID header; a fresh EventSource
  // (new ticket) can't, so the client passes it as ?lastEventId= instead.
  const header = req.headers['last-event-id'];
  const fromHeader = typeof header === 'string' && OBJECT_ID.test(header) ? header : undefined;
  await runNotificationStream(req, res, userId, fromHeader ?? fromQuery);
};

export const list: RequestHandler = async (req, res) => {
  const page = await notificationService.listNotifications(
    getAuthUser(req).userId,
    req.query as unknown as NotificationsQuery,
  );
  res.json(page);
};

export const markRead: RequestHandler = async (req, res) => {
  const unreadCount = await notificationService.markRead(
    getAuthUser(req).userId,
    req.body as MarkNotificationsReadInput,
  );
  res.json({ unreadCount });
};
