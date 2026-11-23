import { messagesPageSchema } from '@teamchat/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Message } from '../src/models/Message.js';
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
  const asha = await makeUser(app, 'Asha');
  const ravi = await makeUser(app, 'Ravi');
  const zed = await makeUser(app, 'Zed');
  const acme = await createWorkspace(app, asha.token);
  await invite(app, asha.token, acme.id, ravi.email);
  const channels = await listChannels(app, asha.token, acme.id);
  const general = channels.body.channels[0] as { id: string };
  return { asha, ravi, zed, acme, general };
}

/** Messages are sent over sockets from Step 2.2; for now seed them directly. */
async function seed(channelId: string, authorId: string, count: number) {
  // Sequential inserts: each _id is greater than the previous one (ObjectIds grow over time).
  for (let i = 1; i <= count; i++) {
    await Message.create({ channelId, authorId, body: `message ${i}` });
  }
}

const getMessages = (token: string, channelId: string, query = '') =>
  request(app).get(`/api/channels/${channelId}/messages${query}`).set(auth(token));

describe('GET /api/channels/:channelId/messages', () => {
  it('pages through history newest first with a cursor (30, 30, 10), no duplicates', async () => {
    const { asha, general } = await setup();
    await seed(general.id, asha.id, 70);

    const seen: string[] = [];
    const sizes: number[] = [];
    let cursor: string | null = null;
    do {
      const res = await getMessages(asha.token, general.id, cursor ? `?before=${cursor}` : '');
      expect(res.status).toBe(200);
      expect(messagesPageSchema.safeParse(res.body).success).toBe(true);
      sizes.push(res.body.messages.length);
      seen.push(...res.body.messages.map((m: { body: string }) => m.body));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(sizes).toEqual([30, 30, 10]);
    expect(new Set(seen).size).toBe(70);
    expect(seen[0]).toBe('message 70'); // newest first
    expect(seen[69]).toBe('message 1');
  });

  it('respects limit and rejects a limit above the max', async () => {
    const { asha, general } = await setup();
    await seed(general.id, asha.id, 5);

    const res = await getMessages(asha.token, general.id, '?limit=2');
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.nextCursor).toBe(res.body.messages[1].id);

    expect((await getMessages(asha.token, general.id, '?limit=500')).status).toBe(400);
  });

  it('returns an empty page with a null cursor for an empty channel', async () => {
    const { asha, general } = await setup();
    const res = await getMessages(asha.token, general.id);
    expect(res.body).toEqual({ messages: [], nextCursor: null });
  });

  it('uses the { channelId, _id } index: no in-memory sort, examines only the page', async () => {
    const { asha, general, acme } = await setup();
    const other = await createChannel(app, asha.token, acme.id, 'other');
    await seed(general.id, asha.id, 40);
    await seed(other.body.channel.id, asha.id, 40);

    const explain = (await Message.find({ channelId: general.id })
      .sort({ _id: -1 })
      .limit(31)
      .explain('executionStats')) as unknown as {
      queryPlanner: { winningPlan: unknown };
      executionStats: { totalDocsExamined: number; nReturned: number };
    };
    const plan = JSON.stringify(explain.queryPlanner.winningPlan);

    expect(plan).toContain('channelId_1__id_-1'); // the compound index
    expect(plan).not.toContain('"SORT"'); // results come pre-sorted from the index
    expect(explain.executionStats.totalDocsExamined).toBe(31); // not 80
    expect(explain.executionStats.nReturned).toBe(31);
  });

  it('returns 403 to a user outside the workspace', async () => {
    const { asha, zed, general } = await setup();
    await seed(general.id, asha.id, 3);

    const res = await getMessages(zed.token, general.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body).not.toHaveProperty('messages');
  });

  it('returns 403 to a workspace member who is not in a private channel', async () => {
    const { asha, ravi, acme } = await setup();
    const priv = await createChannel(app, asha.token, acme.id, 'leadership', true);

    expect((await getMessages(asha.token, priv.body.channel.id)).status).toBe(200);
    const res = await getMessages(ravi.token, priv.body.channel.id);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown channel, 400 for a malformed id or cursor, 401 without a token', async () => {
    const { asha, general } = await setup();

    expect((await getMessages(asha.token, '0123456789abcdef01234567')).status).toBe(404);
    expect((await getMessages(asha.token, 'nope')).status).toBe(400);
    expect((await getMessages(asha.token, general.id, '?before=xyz')).status).toBe(400);
    expect((await request(app).get(`/api/channels/${general.id}/messages`)).status).toBe(401);
  });
});
