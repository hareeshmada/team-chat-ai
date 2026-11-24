import {
  mentionToken,
  publicMessageSchema,
  type PublicMessage,
  type Reaction,
} from '@teamchat/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Message } from '../src/models/Message.js';
import {
  connect,
  nextEvent,
  record,
  request,
  startServer,
  stopServer,
  wait,
  type Client,
} from './helpers/socket.js';
import {
  createChannel,
  createWorkspace,
  invite,
  listChannels,
  makeUser,
} from './helpers/workspace.js';

const app = createApp();

afterEach(stopServer);

async function setup() {
  const url = await startServer(app);
  const asha = await makeUser(app, 'Asha');
  const ravi = await makeUser(app, 'Ravi');
  const zed = await makeUser(app, 'Zed'); // not in the workspace
  const acme = await createWorkspace(app, asha.token);
  await invite(app, asha.token, acme.id, ravi.email);
  const general = (await listChannels(app, asha.token, acme.id)).body.channels[0] as { id: string };
  const ashaSocket = await connect(url, asha.token);
  const raviSocket = await connect(url, ravi.token);
  const zedSocket = await connect(url, zed.token);
  return { url, asha, ravi, zed, acme, general, ashaSocket, raviSocket, zedSocket };
}

async function send(socket: Client, channelId: string, body: string): Promise<PublicMessage> {
  const ack = await request<{ message: PublicMessage }>(socket, 'message:send', {
    channelId,
    body,
    tempId: `t-${Math.random()}`,
  });
  if (!ack.ok) throw new Error(ack.error.code);
  return ack.message;
}

const join = (socket: Client, channelId: string) => request(socket, 'channel:join', { channelId });

describe('message:edit', () => {
  it('lets the author edit: saves, marks edited and broadcasts message:updated', async () => {
    const { general, ashaSocket, raviSocket } = await setup();
    const original = await send(ashaSocket, general.id, 'frist');
    await join(raviSocket, general.id);

    const updated = nextEvent(raviSocket, 'message:updated');
    const ack = await request<{ message: PublicMessage }>(ashaSocket, 'message:edit', {
      messageId: original.id,
      body: '  first  ',
    });

    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    const message = publicMessageSchema.parse(ack.message);
    expect(message.body).toBe('first'); // trimmed
    expect(message.editedAt).not.toBeNull();
    expect((await updated).message).toEqual(message);
    expect((await Message.findById(original.id).lean())!.body).toBe('first');
  });

  it("rejects editing someone else's message, outsiders and unknown ids", async () => {
    const { general, ashaSocket, raviSocket, zedSocket } = await setup();
    const message = await send(ashaSocket, general.id, 'mine');

    const byRavi = await request(raviSocket, 'message:edit', { messageId: message.id, body: 'x' });
    const byZed = await request(zedSocket, 'message:edit', { messageId: message.id, body: 'x' });
    const unknown = await request(ashaSocket, 'message:edit', {
      messageId: '0123456789abcdef01234567',
      body: 'x',
    });
    const empty = await request(ashaSocket, 'message:edit', { messageId: message.id, body: '  ' });

    expect(byRavi).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(byZed).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(unknown).toMatchObject({ ok: false, error: { code: 'MESSAGE_NOT_FOUND' } });
    expect(empty).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect((await Message.findById(message.id).lean())!.body).toBe('mine');
  });

  it('does not mark an unchanged body as edited, and refuses to edit a deleted message', async () => {
    const { general, ashaSocket } = await setup();
    const message = await send(ashaSocket, general.id, 'same');

    const same = await request<{ message: PublicMessage }>(ashaSocket, 'message:edit', {
      messageId: message.id,
      body: 'same',
    });
    expect(same.ok && same.message.editedAt).toBeNull();

    await request(ashaSocket, 'message:delete', { messageId: message.id });
    const afterDelete = await request(ashaSocket, 'message:edit', {
      messageId: message.id,
      body: 'back from the dead',
    });
    expect(afterDelete).toMatchObject({ ok: false, error: { code: 'MESSAGE_DELETED' } });
  });
});

describe('message:delete', () => {
  it('soft-deletes for the author: clears content, keeps the row, broadcasts', async () => {
    const { general, ashaSocket, raviSocket, ravi } = await setup();
    const message = await send(ashaSocket, general.id, `hey ${mentionToken(ravi.id)}`);
    await request(raviSocket, 'reaction:toggle', { messageId: message.id, emoji: '👍' });
    await join(raviSocket, general.id);

    const deleted = nextEvent(raviSocket, 'message:deleted');
    const ack = await request<{ message: PublicMessage }>(ashaSocket, 'message:delete', {
      messageId: message.id,
    });

    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.message).toMatchObject({ body: '', reactions: [], mentionedUserIds: [] });
    expect(ack.message.deletedAt).not.toBeNull();
    expect((await deleted).message.id).toBe(message.id);
    expect(await Message.countDocuments()).toBe(1); // the row stays

    // Deleting again is a harmless no-op (safe to retry after a lost ack).
    const again = await request(ashaSocket, 'message:delete', { messageId: message.id });
    expect(again.ok).toBe(true);
  });

  it("rejects deleting someone else's message", async () => {
    const { general, ashaSocket, raviSocket } = await setup();
    const message = await send(ashaSocket, general.id, 'keep me');
    const ack = await request(raviSocket, 'message:delete', { messageId: message.id });
    expect(ack).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect((await Message.findById(message.id).lean())!.deletedAt).toBeNull();
  });
});

describe('reaction:toggle', () => {
  it('adds and removes per user, groups by emoji and broadcasts reaction:updated', async () => {
    const { general, ashaSocket, raviSocket, asha, ravi } = await setup();
    const message = await send(ashaSocket, general.id, 'react to me');
    await join(raviSocket, general.id);
    const toggle = (socket: Client, emoji: string) =>
      request<{ reactions: Reaction[] }>(socket, 'reaction:toggle', {
        messageId: message.id,
        emoji,
      });

    const updated = nextEvent(raviSocket, 'reaction:updated');
    await toggle(ashaSocket, '👍');
    expect(await updated).toEqual({
      channelId: general.id,
      messageId: message.id,
      reactions: [{ emoji: '👍', userIds: [asha.id] }],
    });

    await toggle(raviSocket, '👍');
    const both = await toggle(raviSocket, '🎉');
    expect(both.ok && both.reactions).toEqual([
      { emoji: '👍', userIds: [asha.id, ravi.id] },
      { emoji: '🎉', userIds: [ravi.id] },
    ]);

    // Toggling again removes; an emoji nobody uses any more disappears.
    await toggle(raviSocket, '🎉');
    const off = await toggle(ashaSocket, '👍');
    expect(off.ok && off.reactions).toEqual([{ emoji: '👍', userIds: [ravi.id] }]);
  });

  it('keeps both reactions when two users react at the same moment', async () => {
    const { general, ashaSocket, raviSocket } = await setup();
    const message = await send(ashaSocket, general.id, 'race');
    await Promise.all([
      request(ashaSocket, 'reaction:toggle', { messageId: message.id, emoji: '🙏' }),
      request(raviSocket, 'reaction:toggle', { messageId: message.id, emoji: '🙏' }),
    ]);
    const saved = (await Message.findById(message.id).lean())!;
    expect(saved.reactions).toHaveLength(1);
    expect(saved.reactions[0]!.userIds).toHaveLength(2);
  });

  it('rejects emoji outside the six, outsiders and deleted messages', async () => {
    const { general, ashaSocket, zedSocket } = await setup();
    const message = await send(ashaSocket, general.id, 'hi');

    const odd = await request(ashaSocket, 'reaction:toggle', {
      messageId: message.id,
      emoji: '🦄',
    });
    const outsider = await request(zedSocket, 'reaction:toggle', {
      messageId: message.id,
      emoji: '👍',
    });
    await request(ashaSocket, 'message:delete', { messageId: message.id });
    const deleted = await request(ashaSocket, 'reaction:toggle', {
      messageId: message.id,
      emoji: '👍',
    });

    expect(odd).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(outsider).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(deleted).toMatchObject({ ok: false, error: { code: 'MESSAGE_DELETED' } });
  });
});

describe('mentions', () => {
  it('keeps only members who can see the channel, without duplicates, also on edit', async () => {
    const { general, ashaSocket, asha, ravi, zed } = await setup();
    const body = `${mentionToken(ravi.id)} ${mentionToken(zed.id)} ${mentionToken(ravi.id)} <@nope>`;
    const message = await send(ashaSocket, general.id, body);
    expect(message.mentionedUserIds).toEqual([ravi.id]); // zed isn't in the workspace
    expect(message.body).toBe(body); // the text keeps its tokens

    const ack = await request<{ message: PublicMessage }>(ashaSocket, 'message:edit', {
      messageId: message.id,
      body: `actually ${mentionToken(asha.id)}`,
    });
    expect(ack.ok && ack.message.mentionedUserIds).toEqual([asha.id]);
  });

  it('in a private channel, only its members count', async () => {
    const { acme, asha, ravi, ashaSocket } = await setup();
    const secret = (await createChannel(app, asha.token, acme.id, 'secret', true)).body.channel as {
      id: string;
    };
    // Ravi is in the workspace but not in #secret.
    const message = await send(ashaSocket, secret.id, `psst ${mentionToken(ravi.id)}`);
    expect(message.mentionedUserIds).toEqual([]);
  });
});

describe('channel:activity', () => {
  it('reaches workspace members who are not in the channel room, without the body', async () => {
    const { general, acme, ashaSocket, raviSocket, zedSocket, ravi } = await setup();
    // Ravi has NOT joined #general's room; he is in the workspace room since connecting.
    const activity = nextEvent(raviSocket, 'channel:activity');
    const zedSeen = record(zedSocket, 'channel:activity');
    const message = await send(ashaSocket, general.id, `hi ${mentionToken(ravi.id)}`);

    expect(await activity).toEqual({
      workspaceId: acme.id,
      channelId: general.id,
      messageId: message.id,
      authorId: message.authorId,
      mentionedUserIds: [ravi.id],
    });
    await wait(100);
    expect(zedSeen).toEqual([]);
  });

  it('for a private channel goes only to its members', async () => {
    const { url, acme, asha, ashaSocket, raviSocket } = await setup();
    const secret = (await createChannel(app, asha.token, acme.id, 'secret', true)).body.channel as {
      id: string;
    };
    const raviSeen = record(raviSocket, 'channel:activity');
    const ashaTab2 = await connect(url, asha.token);
    const ashaActivity = nextEvent(ashaTab2, 'channel:activity');

    await send(ashaSocket, secret.id, 'just us');

    expect((await ashaActivity).channelId).toBe(secret.id);
    await wait(100);
    expect(raviSeen).toEqual([]);
  });
});
