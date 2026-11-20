import type { Express } from 'express';
import request, { type Response } from 'supertest';

export const TEST_USER = { name: 'Asha', email: 'asha@example.com', password: 'correct-horse-1' };

/** Returns the raw Set-Cookie line for the refresh cookie, if any. */
export function getRefreshSetCookie(res: Response): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith('refresh_token='));
}

/** "refresh_token=<value>" ready to send back in a Cookie header. */
export function getRefreshCookie(res: Response): string {
  const line = getRefreshSetCookie(res);
  if (!line) throw new Error('No refresh_token cookie in response');
  return line.split(';')[0]!;
}

export function rawToken(cookie: string): string {
  return cookie.slice('refresh_token='.length);
}

export async function registerUser(app: Express, overrides: Partial<typeof TEST_USER> = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...TEST_USER, ...overrides });
  return { res, accessToken: res.body.accessToken as string, cookie: getRefreshCookie(res) };
}

export function refresh(app: Express, cookie?: string) {
  const req = request(app).post('/api/auth/refresh');
  return cookie ? req.set('Cookie', cookie) : req;
}
