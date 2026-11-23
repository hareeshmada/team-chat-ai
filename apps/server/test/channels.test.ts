import { publicChannelSchema } from '@teamchat/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  auth,
  createChannel,
  createWorkspace,
  invite,
  listChannels,
  makeUser,
} from './helpers/workspace.js';

const app = createApp();

async function setup() {
  const asha = await makeUser(app, 'Asha'); // owner
  const ravi = await makeUser(app, 'Ravi'); // member
  const zed = await makeUser(app, 'Zed'); // not in the workspace
  const acme = await createWorkspace(app, asha.token);
  await invite(app, asha.token, acme.id, ravi.email);
  return { asha, ravi, zed, acme };
}

const names = (body: { channels: { name: string }[] }) => body.channels.map((c) => c.name);

describe('workspace channels', () => {
  it('lets any member create a public channel, visible to all members', async () => {
    const { asha, ravi, acme } = await setup();

    const res = await createChannel(app, ravi.token, acme.id, 'Frontend');
    expect(res.status).toBe(201);
    expect(publicChannelSchema.safeParse(res.body.channel).success).toBe(true);
    expect(res.body.channel).toMatchObject({
      name: 'frontend',
      description: '',
      isPrivate: false,
      memberIds: [],
      createdBy: ravi.id,
    });

    const list = await listChannels(app, asha.token, acme.id);
    expect(list.status).toBe(200);
    expect(names(list.body)).toEqual(['frontend', 'general', 'random']);
  });

  it('returns 403 to a non-member for list and create', async () => {
    const { zed, acme } = await setup();

    expect((await listChannels(app, zed.token, acme.id)).status).toBe(403);
    expect((await createChannel(app, zed.token, acme.id, 'hack')).status).toBe(403);
  });

  it('stores an optional description (trimmed, max 250)', async () => {
    const { asha, acme } = await setup();

    const res = await request(app)
      .post(`/api/workspaces/${acme.id}/channels`)
      .set(auth(asha.token))
      .send({ name: 'design', description: '  Design reviews and UI decisions  ' });
    expect(res.status).toBe(201);
    expect(res.body.channel.description).toBe('Design reviews and UI decisions');

    const tooLong = await request(app)
      .post(`/api/workspaces/${acme.id}/channels`)
      .set(auth(asha.token))
      .send({ name: 'long', description: 'x'.repeat(251) });
    expect(tooLong.status).toBe(400);
  });

  it('rejects a duplicate name with 409 and a bad name with 400', async () => {
    const { asha, acme } = await setup();

    const dup = await createChannel(app, asha.token, acme.id, 'general');
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CHANNEL_NAME_TAKEN');

    const bad = await createChannel(app, asha.token, acme.id, 'has spaces!');
    expect(bad.status).toBe(400);
  });

  it('hides a private channel from workspace members who are not in it', async () => {
    const { asha, ravi, acme } = await setup();

    const res = await createChannel(app, asha.token, acme.id, 'leadership', true);
    expect(res.status).toBe(201);

    expect(res.body.channel.memberIds).toEqual([asha.id]);
    expect(names((await listChannels(app, asha.token, acme.id)).body)).toEqual([
      'general',
      'leadership',
      'random',
    ]);
    expect(names((await listChannels(app, ravi.token, acme.id)).body)).toEqual([
      'general',
      'random',
    ]);
  });

  it('allows the same channel name in different workspaces', async () => {
    const { asha, acme } = await setup();
    const other = await createWorkspace(app, asha.token, 'Other');

    expect((await createChannel(app, asha.token, acme.id, 'frontend')).status).toBe(201);
    expect((await createChannel(app, asha.token, other.id, 'frontend')).status).toBe(201);
  });
});
