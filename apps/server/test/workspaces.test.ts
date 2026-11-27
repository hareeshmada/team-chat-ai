import { publicWorkspaceSchema, workspaceMemberSchema } from '@teamchat/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Channel } from '../src/models/Channel.js';
import { Membership } from '../src/models/Membership.js';
import { auth, createWorkspace, invite, listChannels, makeUser } from './helpers/workspace.js';

const app = createApp();

describe('POST /api/workspaces', () => {
  it('creates the workspace, an owner membership, #general and #random', async () => {
    const owner = await makeUser(app, 'Asha');

    const res = await request(app)
      .post('/api/workspaces')
      .set(auth(owner.token))
      .send({ name: 'Acme Corp!' });

    expect(res.status).toBe(201);
    expect(publicWorkspaceSchema.safeParse(res.body.workspace).success).toBe(true);
    expect(res.body.workspace).toMatchObject({
      name: 'Acme Corp!',
      role: 'owner',
      ownerId: owner.id,
    });
    expect(res.body.workspace.slug).toMatch(/^acme-corp-[a-z0-9]{6}$/);

    const membership = await Membership.findOne({ workspaceId: res.body.workspace.id });
    expect(membership?.role).toBe('owner');
    const channels = await Channel.find({ workspaceId: res.body.workspace.id }).sort({ name: 1 });
    expect(channels.map((c) => [c.name, c.isPrivate])).toEqual([
      ['general', false],
      ['random', false],
    ]);
    expect(channels.every((c) => c.description.length > 0)).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/workspaces').send({ name: 'Acme' });
    expect(res.status).toBe(401);
  });

  it('rejects an empty name with 400', async () => {
    const owner = await makeUser(app, 'Asha');
    const res = await request(app)
      .post('/api/workspaces')
      .set(auth(owner.token))
      .send({ name: ' ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/workspaces', () => {
  it('lists only the workspaces I belong to, with my role in each', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token, 'Acme');
    await createWorkspace(app, ravi.token, 'Ravi Private');
    await invite(app, asha.token, acme.id, ravi.email);

    const res = await request(app).get('/api/workspaces').set(auth(ravi.token));

    expect(res.status).toBe(200);
    expect(
      res.body.workspaces.map((w: { name: string; role: string }) => [w.name, w.role]),
    ).toEqual([
      ['Acme', 'member'],
      ['Ravi Private', 'owner'],
    ]);
  });
});

describe('POST /api/workspaces/:workspaceId/members (invite)', () => {
  it('lets the owner add an existing user as a member', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token);

    const res = await invite(app, asha.token, acme.id, 'RAVI@example.com');

    expect(res.status).toBe(201);
    expect(workspaceMemberSchema.safeParse(res.body.member).success).toBe(true);
    expect(res.body.member).toMatchObject({ userId: ravi.id, role: 'member' });
  });

  it('lets an admin invite, but not a member (403)', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const meena = await makeUser(app, 'Meena');
    const kiran = await makeUser(app, 'Kiran');
    const acme = await createWorkspace(app, asha.token);
    await invite(app, asha.token, acme.id, ravi.email, 'admin');
    await invite(app, asha.token, acme.id, meena.email, 'member');

    const byMember = await invite(app, meena.token, acme.id, kiran.email);
    expect(byMember.status).toBe(403);
    expect(byMember.body.error.code).toBe('FORBIDDEN');

    const byAdmin = await invite(app, ravi.token, acme.id, kiran.email);
    expect(byAdmin.status).toBe(201);
  });

  it('returns 403 for a non-member', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token);

    const res = await invite(app, ravi.token, acme.id, ravi.email);
    expect(res.status).toBe(403);
  });

  it('cannot grant the owner role', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token);

    const res = await request(app)
      .post(`/api/workspaces/${acme.id}/members`)
      .set(auth(asha.token))
      .send({ email: ravi.email, role: 'owner' });
    expect(res.status).toBe(400);
  });

  it('creates a pending invite for an email with no account (Step 5.2)', async () => {
    const asha = await makeUser(app, 'Asha');
    const acme = await createWorkspace(app, asha.token);

    const res = await invite(app, asha.token, acme.id, 'nobody@example.com');
    expect(res.status).toBe(201);
    expect(res.body.invite).toMatchObject({ email: 'nobody@example.com', status: 'pending' });
    expect(res.body.member).toBeUndefined();
  });

  it('returns 409 ALREADY_MEMBER when inviting twice', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token);
    await invite(app, asha.token, acme.id, ravi.email);

    const res = await invite(app, asha.token, acme.id, ravi.email);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });
});

describe('GET /api/workspaces/:workspaceId/members', () => {
  it('lists members (owner first) for a member, 403 for an outsider', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const outsider = await makeUser(app, 'Zed');
    const acme = await createWorkspace(app, asha.token);
    await invite(app, asha.token, acme.id, ravi.email);

    const res = await request(app).get(`/api/workspaces/${acme.id}/members`).set(auth(ravi.token));
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { name: string; role: string }) => [m.name, m.role])).toEqual([
      ['Asha', 'owner'],
      ['Ravi', 'member'],
    ]);
    expect(res.body.members[0]).not.toHaveProperty('passwordHash');

    const denied = await request(app)
      .get(`/api/workspaces/${acme.id}/members`)
      .set(auth(outsider.token));
    expect(denied.status).toBe(403);
  });
});

describe('workspace ids', () => {
  it('returns 400 for a malformed id and 403 for an unknown one (no existence leak)', async () => {
    const asha = await makeUser(app, 'Asha');

    const bad = await listChannels(app, asha.token, 'not-an-id');
    expect(bad.status).toBe(400);

    const unknown = await listChannels(app, asha.token, '0123456789abcdef01234567');
    expect(unknown.status).toBe(403);
  });
});
