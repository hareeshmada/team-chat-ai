import { refreshResponseSchema } from '@teamchat/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { REUSE_GRACE_MS } from '../src/services/auth.service.js';
import { hashToken } from '../src/services/token.service.js';
import {
  getRefreshCookie,
  getRefreshSetCookie,
  rawToken,
  refresh,
  registerUser,
} from './helpers/auth.js';

const app = createApp();

/** Pretend the token was rotated `ms` ago, without waiting in real time. */
async function backdateRotation(cookie: string, ms: number) {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken(cookie)) },
    { revokedAt: new Date(Date.now() - ms) },
  );
}

describe('POST /api/auth/refresh', () => {
  it('rotates: returns a new access token and a NEW refresh cookie', async () => {
    const { cookie: first } = await registerUser(app);

    const res = await refresh(app, first);

    expect(res.status).toBe(200);
    expect(refreshResponseSchema.safeParse(res.body).success).toBe(true);
    const second = getRefreshCookie(res);
    expect(second).not.toBe(first);

    const old = await RefreshToken.findOne({ tokenHash: hashToken(rawToken(first)) });
    expect(old?.revokedAt).toBeInstanceOf(Date);
    expect(old?.replacedBy).toBe(hashToken(rawToken(second)));
  });

  it('stores only the SHA-256 hash, never the raw token', async () => {
    const { cookie } = await registerUser(app);

    expect(await RefreshToken.exists({ tokenHash: rawToken(cookie) })).toBeNull();
    expect(await RefreshToken.exists({ tokenHash: hashToken(rawToken(cookie)) })).not.toBeNull();
  });

  it('returns 401 without a cookie, or with an unknown token', async () => {
    const none = await refresh(app);
    const unknown = await refresh(app, 'refresh_token=made-up-token');

    expect(none.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 401 for an expired token', async () => {
    const { cookie } = await registerUser(app);
    await RefreshToken.updateOne(
      { tokenHash: hashToken(rawToken(cookie)) },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    expect((await refresh(app, cookie)).status).toBe(401);
  });

  it('accepts reuse of a just-rotated token within the grace window (two tabs)', async () => {
    const { cookie: first } = await registerUser(app);
    await refresh(app, first); // tab 1 rotates

    const tab2 = await refresh(app, first); // tab 2 sends the same old token right after

    expect(tab2.status).toBe(200);
    expect(getRefreshSetCookie(tab2)).toBeDefined();
  });

  it('handles two truly parallel refreshes with the same token', async () => {
    const { cookie } = await registerUser(app);

    const [a, b] = await Promise.all([refresh(app, cookie), refresh(app, cookie)]);

    expect([a.status, b.status]).toEqual([200, 200]);
  });

  it('detects reuse after the grace window: 401 and the whole family is revoked', async () => {
    const { cookie: first } = await registerUser(app);
    const second = getRefreshCookie(await refresh(app, first)); // legit rotation
    await backdateRotation(first, REUSE_GRACE_MS + 1000); // first was used 11s ago

    const reuse = await refresh(app, first); // attacker (or victim) replays the old token

    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    // The newest legit token is dead too: the session is over for everyone.
    const victim = await refresh(app, second);
    expect(victim.status).toBe(401);
    expect(victim.body.error.code).toBe('INVALID_REFRESH_TOKEN'); // theft is reported once, not again
    const active = await RefreshToken.countDocuments({ revokedAt: null });
    expect(active).toBe(0);
  });

  it('clears the cookie when refresh fails', async () => {
    const res = await refresh(app, 'refresh_token=made-up-token');

    expect(getRefreshSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const { cookie } = await registerUser(app);

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(getRefreshSetCookie(res)).toMatch(/refresh_token=;.*Path=\/api\/auth/);
  });

  it('a logged-out token gets INVALID_REFRESH_TOKEN, not a false "reused" (theft) error', async () => {
    const { cookie } = await registerUser(app);
    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    const res = await refresh(app, cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('does not let a just-rotated token revive a logged-out session (grace window)', async () => {
    const { cookie: first } = await registerUser(app);
    const second = getRefreshCookie(await refresh(app, first));
    await request(app).post('/api/auth/logout').set('Cookie', second);

    const res = await refresh(app, first); // first is still inside the 10s grace window

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('is idempotent: 204 even without a cookie', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });
});
