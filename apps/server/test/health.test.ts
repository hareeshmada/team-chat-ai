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
