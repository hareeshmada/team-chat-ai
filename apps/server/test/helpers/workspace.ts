import type { Express } from 'express';
import request from 'supertest';
import { registerUser } from './auth.js';

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Registers a user with a unique email; returns their access token and id. */
export async function makeUser(app: Express, name: string) {
  const { res, accessToken } = await registerUser(app, {
    name,
    email: `${name.toLowerCase()}@example.com`,
  });
  return {
    token: accessToken,
    id: res.body.user.id as string,
    email: res.body.user.email as string,
  };
}

export async function createWorkspace(app: Express, token: string, name = 'Acme') {
  const res = await request(app).post('/api/workspaces').set(auth(token)).send({ name });
  if (res.status !== 201) throw new Error(`createWorkspace failed: ${res.status}`);
  return res.body.workspace as { id: string; slug: string };
}

export async function invite(
  app: Express,
  token: string,
  workspaceId: string,
  email: string,
  role?: 'admin' | 'member',
) {
  return request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set(auth(token))
    .send({ email, ...(role && { role }) });
}

export async function createChannel(
  app: Express,
  token: string,
  workspaceId: string,
  name: string,
  isPrivate = false,
) {
  return request(app)
    .post(`/api/workspaces/${workspaceId}/channels`)
    .set(auth(token))
    .send({ name, isPrivate });
}

export async function listChannels(app: Express, token: string, workspaceId: string) {
  return request(app).get(`/api/workspaces/${workspaceId}/channels`).set(auth(token));
}
