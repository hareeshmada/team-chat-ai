import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createAuthRateLimiter, createWriteRateLimiter } from '../src/middleware/rateLimit.js';

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

describe('write (create) rate limiter', () => {
  // Stand-in for requireAuth: the user id comes from an x-user header.
  function makeApp(options: Parameters<typeof createWriteRateLimiter>[0]) {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { userId: String(req.headers['x-user']) };
      next();
    });
    const limiter = createWriteRateLimiter(options); // one shared instance
    app.post('/workspaces', limiter, (_req, res) => res.status(201).json({ ok: true }));
    app.post('/channels', limiter, (_req, res) => res.status(201).json({ ok: true }));
    app.use(errorHandler);
    return app;
  }

  it('limits per user, shares one budget across create endpoints, and returns 429', async () => {
    const app = makeApp({ enabled: true, limit: 3 });

    expect((await request(app).post('/workspaces').set('x-user', 'asha')).status).toBe(201);
    expect((await request(app).post('/channels').set('x-user', 'asha')).status).toBe(201);
    expect((await request(app).post('/workspaces').set('x-user', 'asha')).status).toBe(201);

    const blocked = await request(app).post('/channels').set('x-user', 'asha');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.headers['ratelimit-policy']).toBeDefined();

    // Another user from the same IP has their own budget.
    expect((await request(app).post('/workspaces').set('x-user', 'ravi')).status).toBe(201);
  });

  it('is disabled by default in tests', async () => {
    const app = makeApp({ limit: 1 });
    await request(app).post('/workspaces').set('x-user', 'asha');
    expect((await request(app).post('/workspaces').set('x-user', 'asha')).status).toBe(201);
  });
});
