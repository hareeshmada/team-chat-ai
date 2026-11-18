import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function createThrowingApp() {
  const app = express();
  // Express 5 forwards rejected promises from async handlers to the error handler.
  app.get('/boom', async () => {
    throw new Error('database exploded');
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const originalNodeEnv = env.NODE_ENV;
  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
  });

  it('returns 413 PAYLOAD_TOO_LARGE for a body over 100kb', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .send({ text: 'x'.repeat(101 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 500 with a stack trace outside production', async () => {
    const res = await request(createThrowingApp()).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.stack).toContain('database exploded');
  });

  it('hides the stack trace and the real message in production', async () => {
    env.NODE_ENV = 'production';

    const res = await request(createThrowingApp()).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
