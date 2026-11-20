import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createAuthRateLimiter } from '../src/middleware/rateLimit.js';

describe('auth rate limiter', () => {
  it('allows 10 requests per window, then returns 429 in the standard error shape', async () => {
    const app = express();
    app.post('/login', createAuthRateLimiter({ enabled: true, limit: 10 }), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);

    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/login')).status).toBe(200);
    }
    const blocked = await request(app).post('/login');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.headers['ratelimit-policy']).toBeDefined();
  });

  it('is disabled by default in tests', async () => {
    const app = express();
    app.post('/login', createAuthRateLimiter({ limit: 1 }), (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).post('/login');
    expect((await request(app).post('/login')).status).toBe(200);
  });
});
