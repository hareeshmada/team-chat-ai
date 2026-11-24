import { mentionToken, unreadResponseSchema, UNREAD_CAP } from '@teamchat/shared';
import { Types } from 'mongoose';
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
  const channels = (await listChannels(app, asha.token, acme.id)).body.channels as {
    id: string;
    name: string;
  }[];
  const general = channels.find((c) => c.name === 'general')!;
  const random = channels.find((c) => c.name === 'random')!;
  return { asha, ravi, zed, acme, general, random };
}

/** Sequential inserts so each _id is greater than the previous one. Returns the ids. */
async function seed(channelId: string, authorId: string, count: number, body = 'hello') {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push((await Message.create({ channelId, authorId, body })).id as string);
  }
  return ids;
}

const getUnread = (token: string) => request(app).get('/api/unread').set(auth(token));
const markRead = (token: string, channelId: string, messageId: string) =>
  request(app).post(`/api/channels/${channelId}/read`).set(auth(token)).send({ messageId });

async function unreadFor(token: string, channelId: string) {
  const res = await getUnread(token);
  expect(res.status).toBe(200);
  expect(unreadResponseSchema.safeParse(res.body).success).toBe(true);
  return (res.body.channels as { channelId: string }[]).find((c) => c.channelId === channelId) as
    { count: number; mentionCount: number; lastReadMessageId: string | null } | undefined;
}

describe('GET /api/unread', () => {
  it("counts other people's messages after the read marker, not your own or deleted ones", async () => {
    const { asha, ravi, general } = await setup();
    await seed(general.id, asha.id, 3);
    await seed(general.id, ravi.id, 2); // Ravi's own: never unread for him
    const [deleted] = await seed(general.id, asha.id, 1);
    await Message.updateOne({ _id: deleted }, { deletedAt: new Date(), body: '' });

    expect(await unreadFor(ravi.token, general.id)).toMatchObject({
      count: 3,
      mentionCount: 0,
      lastReadMessageId: null,
    });
    expect((await unreadFor(asha.token, general.id))!.count).toBe(2);
  });

  it('counts mentions of you separately', async () => {
    const { asha, ravi, general } = await setup();
    await seed(general.id, asha.id, 2);
    await seed(general.id, asha.id, 1, `ping ${mentionToken(ravi.id)}`);
    await Message.updateMany(
      { body: { $regex: '^ping' } },
      { $set: { mentionedUserIds: [ravi.id] } },
    );
    expect(await unreadFor(ravi.token, general.id)).toMatchObject({ count: 3, mentionCount: 1 });
  });

  it(`stops counting at ${UNREAD_CAP}`, async () => {
    const { asha, ravi, general } = await setup();
    await Message.insertMany(
      Array.from({ length: UNREAD_CAP + 5 }, (_, i) => ({
        channelId: general.id,
        authorId: asha.id,
        body: `m${i}`,
      })),
    );
    expect((await unreadFor(ravi.token, general.id))!.count).toBe(UNREAD_CAP);
  });

  it('lists only channels you can see (no private channels you are not in)', async () => {
    const { asha, ravi, zed, acme } = await setup();
    const secret = (await createChannel(app, asha.token, acme.id, 'secret', true)).body.channel;
    await seed(secret.id, asha.id, 2);

    expect(await unreadFor(ravi.token, secret.id)).toBeUndefined();
    expect(await unreadFor(asha.token, secret.id)).toMatchObject({ count: 0 });
    const zedRes = await getUnread(zed.token);
    expect(zedRes.body.channels).toEqual([]);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/unread')).status).toBe(401);
  });
});

describe('POST /api/channels/:channelId/read', () => {
  it('moves the marker forward and the unread count drops to what came after', async () => {
    const { asha, ravi, general } = await setup();
    const ids = await seed(general.id, asha.id, 5);

    const res = await markRead(ravi.token, general.id, ids[2]!);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lastReadMessageId: ids[2] });
    expect(await unreadFor(ravi.token, general.id)).toMatchObject({
      count: 2,
      lastReadMessageId: ids[2],
    });
  });

  it('never moves the marker backwards (late request from another tab)', async () => {
    const { asha, ravi, general } = await setup();
    const ids = await seed(general.id, asha.id, 4);
    await markRead(ravi.token, general.id, ids[3]!);

    const late = await markRead(ravi.token, general.id, ids[0]!);
    expect(late.status).toBe(200);
    expect(late.body.lastReadMessageId).toBe(ids[3]);
    expect((await unreadFor(ravi.token, general.id))!.count).toBe(0);
  });

  it('rejects a message from another channel, outsiders and bad ids', async () => {
    const { asha, zed, general, random } = await setup();
    const [inRandom] = await seed(random.id, asha.id, 1);
    const [inGeneral] = await seed(general.id, asha.id, 1);

    expect((await markRead(asha.token, general.id, inRandom!)).status).toBe(404);
    expect((await markRead(zed.token, general.id, inGeneral!)).status).toBe(403);
    expect((await markRead(asha.token, general.id, 'nope')).status).toBe(400);
  });
});

describe('message history with deleted messages', () => {
  it('returns deleted messages as placeholders with an empty body', async () => {
    const { asha, general } = await setup();
    const [id] = await seed(general.id, asha.id, 1, 'secret plans');
    await Message.updateOne({ _id: id }, { deletedAt: new Date(), body: '' });

    const res = await request(app)
      .get(`/api/channels/${general.id}/messages`)
      .set(auth(asha.token));
    expect(res.status).toBe(200);
    expect(res.body.messages[0]).toMatchObject({ id, body: '', reactions: [] });
    expect(res.body.messages[0].deletedAt).not.toBeNull();
  });
});

describe('messages saved before Step 3.1', () => {
  it('still load and count (no reactions / mentionedUserIds / deletedAt fields)', async () => {
    const { asha, ravi, general } = await setup();
    // Raw insert, bypassing Mongoose defaults: what an old document in the database looks like.
    await Message.collection.insertOne({
      channelId: new Types.ObjectId(general.id),
      authorId: new Types.ObjectId(asha.id),
      body: 'from Day 2',
      attachments: [],
      editedAt: null,
      createdAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/channels/${general.id}/messages`)
      .set(auth(asha.token));
    expect(res.status).toBe(200);
    expect(res.body.messages[0]).toMatchObject({
      body: 'from Day 2',
      reactions: [],
      mentionedUserIds: [],
      deletedAt: null,
    });
    expect((await unreadFor(ravi.token, general.id))!.count).toBe(1);
  });
});
