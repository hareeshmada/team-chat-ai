import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  publicMessageSchema,
  type Ack,
  type ClientToServerEvents,
  type PresenceUpdatePayload,
  type ServerToClientEvents,
} from '@teamchat/shared';
import jwt from 'jsonwebtoken';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Message } from '../src/models/Message.js';
import { createSocketServer, type SocketServerOptions } from '../src/socket/index.js';
import type { IoServer } from '../src/socket/types.js';
import {
  createChannel,
  createWorkspace,
  invite,
  listChannels,
  makeUser,
} from './helpers/workspace.js';

type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const app = createApp();

let httpServer: HttpServer | undefined;
let io: IoServer | undefined;
const clients: Client[] = [];

/** A real HTTP + Socket.IO server on a random free port. */
async function startServer(options?: SocketServerOptions): Promise<string> {
  httpServer = createServer(app);
  io = createSocketServer(httpServer, options);
  await new Promise<void>((resolve) => httpServer!.listen(0, resolve));
  return `http://localhost:${(httpServer.address() as AddressInfo).port}`;
}

/** Connected client, or rejects with the connect_error. */
function connect(url: string, token?: string): Promise<Client> {
  const socket: Client = ioClient(url, {
    auth: token === undefined ? {} : { token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** Resolves with the next payload of `event`, or rejects after `ms`. */
function nextEvent<E extends keyof ServerToClientEvents>(
  socket: Client,
  event: E,
  ms = 2_000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No ${event} within ${ms}ms`)), ms);
    // Socket.IO's typed `once` can't narrow a generic event name, hence the casts.
    (socket.once as (e: string, cb: (p: unknown) => void) => void)(event, (payload) => {
      clearTimeout(timer);
      resolve(payload as Parameters<ServerToClientEvents[E]>[0]);
    });
  });
}

/** Collects every payload of `event` from now on (to assert something did NOT arrive). */
function record<E extends keyof ServerToClientEvents>(socket: Client, event: E) {
  const seen: unknown[] = [];
  (socket.on as (e: string, cb: (p: unknown) => void) => void)(event, (p) => seen.push(p));
  return seen as Parameters<ServerToClientEvents[E]>[0][];
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Emits with an ack and resolves with the server's answer. */
function request<T extends object = object>(
  socket: Client,
  event: 'channel:join' | 'channel:leave' | 'message:send' | 'presence:list',
  payload: unknown,
): Promise<Ack<T>> {
  return (socket.timeout(2_000).emitWithAck as (e: string, p: unknown) => Promise<Ack<T>>)(
    event,
    payload,
  );
}

async function setup() {
  const asha = await makeUser(app, 'Asha');
  const ravi = await makeUser(app, 'Ravi');
  const zed = await makeUser(app, 'Zed'); // not in the workspace
  const acme = await createWorkspace(app, asha.token);
  await invite(app, asha.token, acme.id, ravi.email);
  const general = (await listChannels(app, asha.token, acme.id)).body.channels[0] as { id: string };
  return { asha, ravi, zed, acme, general };
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await io?.close(); // also closes httpServer
  io = undefined;
  httpServer = undefined;
});

describe('socket handshake auth', () => {
  it('rejects a connection without a token', async () => {
    const url = await startServer();
    const err = await connect(url).catch((e: Error & { data?: { code: string } }) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { data?: { code: string } }).data?.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid token', async () => {
    const url = await startServer();
    const err = await connect(url, 'not-a-jwt').catch(
      (e: Error & { data?: { code: string } }) => e,
    );
    expect((err as { data?: { code: string } }).data?.code).toBe('INVALID_TOKEN');
  });

  it('accepts a valid access token', async () => {
    const url = await startServer();
    const { asha } = await setup();
    const socket = await connect(url, asha.token);
    expect(socket.connected).toBe(true);
  });
});

describe('channel:join', () => {
  it('lets members join and rejects outsiders, private channels and bad ids', async () => {
    const url = await startServer();
    const { asha, ravi, zed, acme, general } = await setup();
    const secret = (await createChannel(app, asha.token, acme.id, 'secret', true)).body.channel as {
      id: string;
    };

    const ashaSocket = await connect(url, asha.token);
    const raviSocket = await connect(url, ravi.token);
    const zedSocket = await connect(url, zed.token);

    expect(await request(ashaSocket, 'channel:join', { channelId: general.id })).toEqual({
      ok: true,
    });
    expect(await request(ashaSocket, 'channel:join', { channelId: secret.id })).toEqual({
      ok: true,
    });

    const outsider = await request(zedSocket, 'channel:join', { channelId: general.id });
    expect(outsider).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const notInPrivate = await request(raviSocket, 'channel:join', { channelId: secret.id });
    expect(notInPrivate).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const badId = await request(ashaSocket, 'channel:join', { channelId: 'nope' });
    expect(badId).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });

    const unknown = await request(ashaSocket, 'channel:join', {
      channelId: '0123456789abcdef01234567',
    });
    expect(unknown).toMatchObject({ ok: false, error: { code: 'CHANNEL_NOT_FOUND' } });
  });
});

describe('message:send', () => {
  it('saves the message, acks the sender and broadcasts message:new to the room', async () => {
    const url = await startServer();
    const { asha, ravi, general } = await setup();
    const ashaSocket = await connect(url, asha.token);
    const raviSocket = await connect(url, ravi.token);
    await request(ashaSocket, 'channel:join', { channelId: general.id });
    await request(raviSocket, 'channel:join', { channelId: general.id });

    const raviReceives = nextEvent(raviSocket, 'message:new');
    const ashaReceives = nextEvent(ashaSocket, 'message:new'); // the sender's tabs get it too
    const ack = await request<{ message: { id: string } }>(ashaSocket, 'message:send', {
      channelId: general.id,
      body: '  hello ravi  ',
      tempId: 'tmp-1',
    });

    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    const saved = publicMessageSchema.parse(ack.message);
    expect(saved).toMatchObject({ channelId: general.id, authorId: asha.id, body: 'hello ravi' });

    const received = await raviReceives;
    expect(received).toEqual({ message: saved, tempId: 'tmp-1' });
    expect((await ashaReceives).tempId).toBe('tmp-1');

    // Persisted, and visible to the HTTP history endpoint's model.
    const inDb = await Message.findById(saved.id).lean();
    expect(inDb?.body).toBe('hello ravi');
  });

  it('rejects invalid payloads with an ack error, and the socket keeps working', async () => {
    const url = await startServer();
    const { asha, general } = await setup();
    const socket = await connect(url, asha.token);

    for (const bad of [
      { channelId: general.id, body: '   ', tempId: 't' }, // empty after trim
      { channelId: general.id, body: 'x'.repeat(4001), tempId: 't' },
      { channelId: general.id, body: 'hi' }, // no tempId
      { channelId: 'nope', body: 'hi', tempId: 't' },
      'not an object',
    ]) {
      const ack = await request(socket, 'message:send', bad);
      expect(ack).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    }
    expect(await Message.countDocuments()).toBe(0);

    const ok = await request(socket, 'message:send', {
      channelId: general.id,
      body: 'still alive',
      tempId: 't2',
    });
    expect(ok.ok).toBe(true);
  });

  it('checks access on send, even without joining the room', async () => {
    const url = await startServer();
    const { zed, general } = await setup();
    const socket = await connect(url, zed.token);
    const ack = await request(socket, 'message:send', {
      channelId: general.id,
      body: 'let me in',
      tempId: 't',
    });
    expect(ack).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await Message.countDocuments()).toBe(0);
  });

  it('does not deliver to sockets that left the room', async () => {
    const url = await startServer();
    const { asha, ravi, general } = await setup();
    const ashaSocket = await connect(url, asha.token);
    const raviSocket = await connect(url, ravi.token);
    await request(raviSocket, 'channel:join', { channelId: general.id });
    await request(raviSocket, 'channel:leave', { channelId: general.id });
    const seen = record(raviSocket, 'message:new');

    await request(ashaSocket, 'message:send', { channelId: general.id, body: 'hi', tempId: 't' });
    await wait(100);
    expect(seen).toHaveLength(0);
  });

  it('rate-limits sends per user', async () => {
    const url = await startServer({ messageLimit: { limit: 3, windowMs: 60_000 } });
    const { asha, general } = await setup();
    const socket = await connect(url, asha.token);
    const send = (i: number) =>
      request(socket, 'message:send', { channelId: general.id, body: `m${i}`, tempId: `t${i}` });

    for (let i = 1; i <= 3; i++) expect((await send(i)).ok).toBe(true);
    expect(await send(4)).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    expect(await Message.countDocuments()).toBe(3);
  });
});

describe('typing', () => {
  it('reaches others in the room (not the sender), throttles starts, clears on disconnect', async () => {
    const url = await startServer();
    const { asha, ravi, general } = await setup();
    const ashaSocket = await connect(url, asha.token);
    const raviSocket = await connect(url, ravi.token);
    await request(ashaSocket, 'channel:join', { channelId: general.id });
    await request(raviSocket, 'channel:join', { channelId: general.id });

    const ashaSeen = record(ashaSocket, 'typing:update');
    const raviSeen = record(raviSocket, 'typing:update');

    ashaSocket.emit('typing:start', { channelId: general.id });
    ashaSocket.emit('typing:start', { channelId: general.id }); // throttled
    ashaSocket.emit('typing:start', { channelId: general.id }); // throttled
    await wait(100);
    expect(raviSeen).toEqual([{ channelId: general.id, userId: asha.id, isTyping: true }]);
    expect(ashaSeen).toHaveLength(0);

    ashaSocket.emit('typing:stop', { channelId: general.id });
    await wait(100);
    expect(raviSeen.at(-1)).toEqual({ channelId: general.id, userId: asha.id, isTyping: false });

    // Typing again, then the tab closes: Ravi gets a final "stopped".
    ashaSocket.emit('typing:start', { channelId: general.id });
    await wait(50);
    expect(raviSeen).toHaveLength(3); // not throttled: the stop reset the window
    ashaSocket.disconnect();
    await wait(100);
    expect(raviSeen.at(-1)).toEqual({ channelId: general.id, userId: asha.id, isTyping: false });
  });

  it('ignores typing for a channel the socket has not joined', async () => {
    const url = await startServer();
    const { asha, ravi, general } = await setup();
    const ashaSocket = await connect(url, asha.token); // never joins
    const raviSocket = await connect(url, ravi.token);
    await request(raviSocket, 'channel:join', { channelId: general.id });
    const raviSeen = record(raviSocket, 'typing:update');

    ashaSocket.emit('typing:start', { channelId: general.id });
    ashaSocket.emit('typing:start', { nonsense: true } as never);
    await wait(100);
    expect(raviSeen).toHaveLength(0);
  });
});

describe('presence', () => {
  it('announces online once per user, offline after the last tab, and lists who is online', async () => {
    const url = await startServer();
    const { asha, ravi, zed, acme } = await setup();
    const ashaSocket = await connect(url, asha.token);
    const updates = record(ashaSocket, 'presence:update');

    const raviTab1 = await connect(url, ravi.token);
    await wait(100);
    expect(updates).toEqual<PresenceUpdatePayload[]>([
      { workspaceId: acme.id, userId: ravi.id, online: true },
    ]);

    const raviTab2 = await connect(url, ravi.token);
    await wait(100);
    expect(updates).toHaveLength(1); // second tab: no new "online"

    const list = await request<{ userIds: string[] }>(ashaSocket, 'presence:list', {
      workspaceId: acme.id,
    });
    expect(list.ok && [...list.userIds].sort()).toEqual([asha.id, ravi.id].sort());

    raviTab1.disconnect();
    await wait(100);
    expect(updates).toHaveLength(1); // one tab still open

    raviTab2.disconnect();
    await wait(100);
    expect(updates.at(-1)).toEqual({ workspaceId: acme.id, userId: ravi.id, online: false });

    // Outsiders can't read a workspace's presence.
    const zedSocket = await connect(url, zed.token);
    const denied = await request(zedSocket, 'presence:list', { workspaceId: acme.id });
    expect(denied).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('does not send presence to users outside the workspace', async () => {
    const url = await startServer();
    const { ravi, zed } = await setup();
    const zedSocket = await connect(url, zed.token);
    const zedSeen = record(zedSocket, 'presence:update');
    await connect(url, ravi.token);
    await wait(100);
    expect(zedSeen).toHaveLength(0);
  });
});

describe('workspace:added (invite while online)', () => {
  it('tells the invitee, joins them to presence, and announces them online', async () => {
    const url = await startServer();
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token);

    const ashaSocket = await connect(url, asha.token);
    const raviTab1 = await connect(url, ravi.token); // Ravi is online, in no workspace yet
    const raviTab2 = await connect(url, ravi.token);
    const ashaPresence = record(ashaSocket, 'presence:update');

    const added1 = nextEvent(raviTab1, 'workspace:added');
    const added2 = nextEvent(raviTab2, 'workspace:added');
    expect((await invite(app, asha.token, acme.id, ravi.email)).status).toBe(201);

    const payload = await added1;
    expect(payload.workspace).toMatchObject({ id: acme.id, role: 'member' });
    expect((await added2).workspace.id).toBe(acme.id); // every tab
    await wait(50);
    expect(ashaPresence).toEqual([{ workspaceId: acme.id, userId: ravi.id, online: true }]);

    // Ravi's sockets are now in the workspace room: his going offline reaches Asha...
    raviTab1.disconnect();
    raviTab2.disconnect();
    await wait(100);
    expect(ashaPresence.at(-1)).toEqual({ workspaceId: acme.id, userId: ravi.id, online: false });
  });

  it('does not notify other users', async () => {
    const url = await startServer();
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const zed = await makeUser(app, 'Zed');
    const acme = await createWorkspace(app, asha.token);
    const zedSocket = await connect(url, zed.token);
    const zedSeen = record(zedSocket, 'workspace:added');

    await invite(app, asha.token, acme.id, ravi.email);
    await wait(100);
    expect(zedSeen).toHaveLength(0);
  });
});

describe('workspace rooms for workspaces joined while connected', () => {
  it('presence:list joins the socket to the workspace room (created after connecting)', async () => {
    const url = await startServer();
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const ashaSocket = await connect(url, asha.token); // connected with no workspace
    const ashaAdded = nextEvent(ashaSocket, 'workspace:added'); // her own tabs hear about it
    const acme = await createWorkspace(app, asha.token);
    expect((await ashaAdded).workspace).toMatchObject({ id: acme.id, role: 'owner' });

    await request(ashaSocket, 'presence:list', { workspaceId: acme.id });
    const updates = record(ashaSocket, 'presence:update');
    await invite(app, asha.token, acme.id, ravi.email);
    const raviSocket = await connect(url, ravi.token);
    await wait(100);
    raviSocket.disconnect();
    await wait(100);
    expect(updates.map((u) => u.online)).toEqual([true, false]);
  });
});

describe('latency:ping', () => {
  it('acks immediately', async () => {
    const url = await startServer();
    const { asha } = await setup();
    const socket = await connect(url, asha.token);
    const res = await (socket.timeout(2_000).emitWithAck as (e: string) => Promise<unknown>)(
      'latency:ping',
    );
    expect(res).toEqual({ ok: true });
  });
});

describe('expired token', () => {
  it('rejects an expired access token with TOKEN_EXPIRED', async () => {
    const url = await startServer();
    const { asha } = await setup();
    const expired = jwt.sign({}, process.env.JWT_ACCESS_SECRET!, {
      subject: asha.id,
      expiresIn: -10,
      algorithm: 'HS256',
    });
    const err = await connect(url, expired).catch((e: { data?: { code: string } }) => e);
    expect((err as { data?: { code: string } }).data?.code).toBe('TOKEN_EXPIRED');
  });
});
