import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  // /health for infra probes (load balancer, Docker); /api/health so the client can reach it via the /api proxy.
  app.use(['/health', '/api/health'], healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
