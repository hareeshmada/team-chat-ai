import { healthResponseSchema } from '@teamchat/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /health', () => {
  it.each(['/health', '/api/health'])(
    'GET %s returns 200 with a body matching the shared schema',
    async (path) => {
      const res = await request(createApp()).get(path);

      expect(res.status).toBe(200);
      expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
    },
  );

  it('returns 404 in the standard error shape for unknown routes', async () => {
    const res = await request(createApp()).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /does-not-exist not found' },
    });
  });
});

describe('request id', () => {
  it('generates an X-Request-Id for every response', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses a valid incoming X-Request-Id', async () => {
    const res = await request(createApp()).get('/health').set('X-Request-Id', 'trace-123');

    expect(res.headers['x-request-id']).toBe('trace-123');
  });

  it('replaces an unsafe incoming X-Request-Id', async () => {
    const res = await request(createApp()).get('/health').set('X-Request-Id', 'bad id with spaces');

    expect(res.headers['x-request-id']).not.toBe('bad id with spaces');
  });
});

describe('security middleware', () => {
  it('sets helmet security headers', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
