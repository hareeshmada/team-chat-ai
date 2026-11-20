import { authResponseSchema } from '@teamchat/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { getRefreshSetCookie, registerUser, TEST_USER } from './helpers/auth.js';

const app = createApp();

describe('POST /api/auth/register', () => {
  it('creates a user, returns an access token and sets the refresh cookie', async () => {
    const { res } = await registerUser(app);

    expect(res.status).toBe(201);
    expect(authResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.user).toMatchObject({ name: 'Asha', email: 'asha@example.com' });

    const cookie = getRefreshSetCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).not.toMatch(/Secure/i); // only in production
  });

  it('never returns the password hash', async () => {
    const { res } = await registerUser(app);

    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|correct-horse/);
  });

  it('stores the email trimmed + lowercased and the password hashed', async () => {
    await registerUser(app, { email: '  Asha@Example.COM ' });

    const stored = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    expect(stored).not.toBeNull();
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt format
    expect(stored!.passwordHash).not.toContain(TEST_USER.password);
  });

  it('rejects a duplicate email (any letter case) with 409', async () => {
    await registerUser(app);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, email: 'ASHA@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns 400 VALIDATION_ERROR for a bad body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'nope', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('rejects passwords over 72 characters (bcrypt limit)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, password: 'x'.repeat(73) });

    expect(res.status).toBe(400);
  });

  it('counts the 72-byte limit in bytes, not characters (multibyte passwords)', async () => {
    const seventyTwoBytes = 'é'.repeat(36); // 36 characters, 72 bytes in UTF-8

    const tooLong = await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, password: seventyTwoBytes + 'A' }); // 37 chars, 73 bytes
    const telugu = await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, password: 'తెలుగు'.repeat(5) }); // 30 chars, 90 bytes
    const exact = await registerUser(app, { password: seventyTwoBytes });

    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.details[0]).toMatchObject({ path: 'password' });
    expect(telugu.status).toBe(400);
    expect(exact.res.status).toBe(201);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser(app);
  });

  it('logs in with the right password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ASHA@example.com', password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(authResponseSchema.safeParse(res.body).success).toBe(true);
    expect(getRefreshSetCookie(res)).toBeDefined();
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    expect(getRefreshSetCookie(wrongPassword)).toBeUndefined();
  });
});
