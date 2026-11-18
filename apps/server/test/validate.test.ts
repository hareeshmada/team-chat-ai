import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validate } from '../src/middleware/validate.js';

// Test-only mini app: exercises validate() + errorHandler without adding a fake endpoint to the real app.
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.post(
    '/items/:id',
    validate({
      params: z.object({ id: z.string().length(4) }),
      body: z.object({ name: z.string().min(1), email: z.email() }),
    }),
    (req, res) => {
      res.json({ params: req.params, body: req.body });
    },
  );

  app.get(
    '/items',
    validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }) }),
    (req, res) => {
      res.json({ query: req.query });
    },
  );

  app.use(errorHandler);
  return app;
}

describe('validate()', () => {
  it('returns 400 VALIDATION_ERROR with field details for an invalid body', async () => {
    const res = await request(createTestApp())
      .post('/items/abcd')
      .send({ name: '', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: 'body', path: 'name' }),
        expect.objectContaining({ location: 'body', path: 'email' }),
      ]),
    );
  });

  it('reports params and body issues together', async () => {
    const res = await request(createTestApp()).post('/items/x').send({ name: 'a', email: 'bad' });

    expect(res.status).toBe(400);
    const locations = res.body.error.details.map((d: { location: string }) => d.location);
    expect(locations).toEqual(expect.arrayContaining(['params', 'body']));
  });

  it('returns 400 for an invalid query', async () => {
    const res = await request(createTestApp()).get('/items?limit=999');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ location: 'query', path: 'limit' });
  });

  it('replaces req.query with parsed values (coerced + defaults)', async () => {
    const withLimit = await request(createTestApp()).get('/items?limit=5');
    const withDefault = await request(createTestApp()).get('/items');

    expect(withLimit.body.query).toEqual({ limit: 5 }); // number, not "5"
    expect(withDefault.body.query).toEqual({ limit: 20 });
  });

  it('strips unknown body keys', async () => {
    const res = await request(createTestApp())
      .post('/items/abcd')
      .send({ name: 'general', email: 'a@b.co', isAdmin: true });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'general', email: 'a@b.co' });
  });
});
