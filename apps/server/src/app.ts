import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import { aiRouter } from './routes/ai.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { channelRouter } from './routes/channel.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { unreadRouter } from './routes/unread.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { workspaceRouter } from './routes/workspace.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // First, so every later log line (and 404s/errors) carries the request id.
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // /health for infra probes (load balancer, Docker); /api/health so the client can reach it via the /api proxy.
  app.use(['/health', '/api/health'], healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspaceRouter);
  app.use('/api/channels', channelRouter);
  app.use('/api/unread', unreadRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/uploads', uploadRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
