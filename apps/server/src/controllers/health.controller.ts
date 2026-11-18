import type { HealthResponse } from '@teamchat/shared';
import type { RequestHandler } from 'express';

export const getHealth: RequestHandler = (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  res.json(body);
};
