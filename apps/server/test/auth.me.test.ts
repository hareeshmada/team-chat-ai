import { publicUserSchema } from '@teamchat/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { registerUser } from './helpers/auth.js';

const app = createApp();

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid access token', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(publicUserSchema.safeParse(res.body.user).success).toBe(true);
    expect(res.body.user.email).toBe('asha@example.com');
  });

  it('accepts the scheme name in any case ("bearer")', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 UNAUTHORIZED without a token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 INVALID_TOKEN for a tampered or wrongly-signed token', async () => {
    const { accessToken } = await registerUser(app);
    const forged = jwt.sign({ sub: 'someone-else' }, 'not-the-real-secret-but-32-chars-long!!');

    for (const token of [`${accessToken}x`, forged]) {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    }
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const { res: reg } = await registerUser(app);
    const unsigned = jwt.sign({ sub: reg.body.user.id }, '', { algorithm: 'none' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${unsigned}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 TOKEN_EXPIRED for an expired token', async () => {
    const { res: reg } = await registerUser(app);
    const expired = jwt.sign(
      { sub: reg.body.user.id, exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_ACCESS_SECRET,
    );

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 401 if the user was deleted after the token was issued', async () => {
    const { accessToken } = await registerUser(app);
    await User.deleteMany({});

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
  });
});
