import {
  mentionToken,
  notificationsPageSchema,
  publicNotificationSchema,
  streamTicketResponseSchema,
  type PublicMessage,
  type PublicNotification,
} from '@teamchat/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { notificationListenerCount } from '../src/lib/eventBus.js';
import { redactUrl } from '../src/lib/redact.js';
import { Notification } from '../src/models/Notification.js';
import { TICKET_TTL_MS } from '../src/services/streamTicket.service.js';
import { sseConfig } from '../src/sse/notificationStream.js';
import {
  connect,
  request as emit,
  startServer,
  stopServer,
  wait,
  type Client,
} from './helpers/socket.js';
import {
  auth,
  createChannel,
  createWorkspace,
  invite,
  listChannels,
  makeUser,
} from './helpers/workspace.js';

const app = createApp();
const defaults = { ...sseConfig };

afterEach(async () => {
  Object.assign(sseConfig, defaults);
  vi.restoreAllMocks();
  for (const s of streams.splice(0)) s.close();
  await stopServer();
});

async function setup() {
  const url = await startServer(app);
  const asha = await makeUser(app, 'Asha');
  const ravi = await makeUser(app, 'Ravi');
  const zed = await makeUser(app, 'Zed');
  const acme = await createWorkspace(app, asha.token);
  await invite(app, asha.token, acme.id, ravi.email);
  const general = (await listChannels(app, asha.token, acme.id)).body.channels[0] as { id: string };
  return { url, asha, ravi, zed, acme, general };
}

const getTicket = async (token: string) => {
  const res = await request(app).post('/api/notifications/stream-ticket').set(auth(token));
  expect(res.status).toBe(201);
  return streamTicketResponseSchema.parse(res.body).ticket;
};

async function send(socket: Client, channelId: string, body: string): Promise<PublicMessage> {
  const ack = await emit<{ message: PublicMessage }>(socket, 'message:send', {
    channelId,
    body,
    tempId: `t-${Math.random()}`,
  });
  if (!ack.ok) throw new Error(ack.error.code);
  return ack.message;
}

/** Polls until `check` passes (notifications are created right after the ack/response). */
async function eventually(check: () => Promise<void> | void, ms = 2_000) {
  const start = Date.now();
  for (;;) {
    try {
      return await check();
    } catch (err) {
      if (Date.now() - start > ms) throw err;
      await wait(20);
    }
  }
}

interface SseEvent {
  id?: string;
  event?: string;
  data?: string;
}

/** A real SSE client over fetch: collects parsed events and comment lines. */
interface Stream {
  status: number;
  headers: Headers;
  events: SseEvent[];
  comments: string[];
  raw: string;
  notifications: () => PublicNotification[];
  close: () => void;
}
const streams: Stream[] = [];

async function openStream(
  url: string,
  ticket: string,
  { lastEventId, header }: { lastEventId?: string; header?: string } = {},
): Promise<Stream> {
  const controller = new AbortController();
  const query = new URLSearchParams({ ticket, ...(lastEventId && { lastEventId }) });
  const res = await fetch(`${url}/api/notifications/stream?${query}`, {
    signal: controller.signal,
    headers: header ? { 'Last-Event-ID': header } : {},
  });
  const stream: Stream = {
    status: res.status,
    headers: res.headers,
    events: [],
    comments: [],
    raw: '',
    notifications: () =>
      stream.events
        .filter((e) => e.event === 'notification')
        .map((e) => publicNotificationSchema.parse(JSON.parse(e.data!))),
    close: () => controller.abort(),
  };
  streams.push(stream);
  if (res.status !== 200 || !res.body) return stream;

  // Read in the background; frames are separated by a blank line.
  void (async () => {
    const decoder = new TextDecoder();
    let pending = '';
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        const text = decoder.decode(chunk, { stream: true });
        stream.raw += text;
        pending += text;
        let end: number;
        while ((end = pending.indexOf('\n\n')) !== -1) {
          const block = pending.slice(0, end);
          pending = pending.slice(end + 2);
          const event: SseEvent = {};
          for (const line of block.split('\n')) {
            if (line.startsWith(':')) stream.comments.push(line.slice(1).trim());
            else {
              const [field, ...rest] = line.split(': ');
              if (field === 'id' || field === 'event' || field === 'data') {
                event[field] = rest.join(': ');
              }
            }
          }
          if (event.event) stream.events.push(event);
        }
      }
    } catch {
      // aborted
    }
  })();
  return stream;
}

describe('POST /api/notifications/stream-ticket', () => {
  it('needs a logged-in user and returns a 60 s ticket', async () => {
    const asha = await makeUser(app, 'Asha');
    expect((await request(app).post('/api/notifications/stream-ticket')).status).toBe(401);

    const res = await request(app).post('/api/notifications/stream-ticket').set(auth(asha.token));
    expect(res.status).toBe(201);
    const { expiresAt } = streamTicketResponseSchema.parse(res.body);
    const ttl = new Date(expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(TICKET_TTL_MS - 5_000);
    expect(ttl).toBeLessThanOrEqual(TICKET_TTL_MS);
  });
});

describe('GET /api/notifications/stream', () => {
  it('rejects a missing, unknown, reused or expired ticket with a JSON error', async () => {
    const { url, asha } = await setup();
    expect((await openStream(url, '')).status).toBe(400);
    expect((await openStream(url, 'not-a-ticket')).status).toBe(401);

    const once = await getTicket(asha.token);
    expect((await openStream(url, once)).status).toBe(200);
    expect((await openStream(url, once)).status).toBe(401); // single use

    const old = await getTicket(asha.token);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + TICKET_TTL_MS + 1);
    expect((await openStream(url, old)).status).toBe(401);
  });

  it('streams with SSE headers, a retry hint and heartbeats', async () => {
    sseConfig.heartbeatMs = 50;
    const { url, asha } = await setup();
    const stream = await openStream(url, await getTicket(asha.token));

    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(stream.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(stream.headers.get('x-accel-buffering')).toBe('no');
    await eventually(() => expect(stream.comments.filter((c) => c === 'ping').length).toBe(2));
    expect(stream.raw.startsWith('retry: 3000\n\n')).toBe(true);
  });

  it('pushes a mention to the mentioned user only, as id/event/data', async () => {
    const { url, asha, ravi, zed, general } = await setup();
    const raviStream = await openStream(url, await getTicket(ravi.token));
    const zedStream = await openStream(url, await getTicket(zed.token));
    const ashaSocket = await connect(url, asha.token);

    const message = await send(ashaSocket, general.id, `hey ${mentionToken(ravi.id)}, review?`);

    await eventually(() => expect(raviStream.events).toHaveLength(1));
    const [event] = raviStream.events;
    const notification = raviStream.notifications()[0]!;
    expect(event!.event).toBe('notification');
    expect(event!.id).toBe(notification.id);
    expect(notification).toMatchObject({
      type: 'mention',
      readAt: null,
      payload: {
        channelId: general.id,
        channelName: 'general',
        messageId: message.id,
        authorId: asha.id,
        authorName: 'Asha',
        excerpt: 'hey @Ravi, review?',
      },
    });
    await wait(100);
    expect(zedStream.events).toEqual([]);
  });

  it('replays what was missed after Last-Event-ID (header or ?lastEventId=), oldest first', async () => {
    const { url, asha, ravi, general } = await setup();
    const ashaSocket = await connect(url, asha.token);
    const first = await openStream(url, await getTicket(ravi.token));
    await send(ashaSocket, general.id, `one ${mentionToken(ravi.id)}`);
    await eventually(() => expect(first.events).toHaveLength(1));
    const lastSeen = first.events[0]!.id!;
    first.close();

    // While disconnected: two more mentions.
    await send(ashaSocket, general.id, `two ${mentionToken(ravi.id)}`);
    await send(ashaSocket, general.id, `three ${mentionToken(ravi.id)}`);
    await eventually(async () => expect(await Notification.countDocuments()).toBe(3));

    const byHeader = await openStream(url, await getTicket(ravi.token), { header: lastSeen });
    await eventually(() => expect(byHeader.events).toHaveLength(2));
    expect(byHeader.notifications().map((n) => n.type === 'mention' && n.payload.excerpt)).toEqual([
      'two @Ravi',
      'three @Ravi',
    ]);

    const byQuery = await openStream(url, await getTicket(ravi.token), { lastEventId: lastSeen });
    await eventually(() => expect(byQuery.events).toHaveLength(2));

    // Live events still arrive after the replay, exactly once.
    await send(ashaSocket, general.id, `four ${mentionToken(ravi.id)}`);
    await eventually(() => expect(byQuery.events).toHaveLength(3));
    await wait(100);
    expect(new Set(byQuery.events.map((e) => e.id)).size).toBe(3);
  });

  it('removes its bus listener when the client disconnects', async () => {
    const { url, ravi } = await setup();
    const stream = await openStream(url, await getTicket(ravi.token));
    await eventually(() => expect(notificationListenerCount(ravi.id)).toBe(1));
    stream.close();
    await eventually(() => expect(notificationListenerCount(ravi.id)).toBe(0));
  });

  it('limits open streams per user', async () => {
    sseConfig.maxStreamsPerUser = 1;
    const { url, ravi } = await setup();
    expect((await openStream(url, await getTicket(ravi.token))).status).toBe(200);
    expect((await openStream(url, await getTicket(ravi.token))).status).toBe(429);
  });
});

describe('creating notifications', () => {
  it('notifies the invitee: "X added you to Y"', async () => {
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token, 'Acme');
    await invite(app, asha.token, acme.id, ravi.email, 'admin');

    await eventually(async () => {
      const page = await request(app).get('/api/notifications').set(auth(ravi.token));
      expect(page.body.notifications).toHaveLength(1);
      expect(page.body.notifications[0]).toMatchObject({
        type: 'invite',
        payload: {
          workspaceId: acme.id,
          workspaceName: 'Acme',
          invitedByName: 'Asha',
          role: 'admin',
        },
      });
    });
  });

  it('skips mentioning yourself, and an edit only notifies newly mentioned people', async () => {
    const { url, asha, ravi, acme, general } = await setup();
    const tom = await makeUser(app, 'Tom');
    await invite(app, asha.token, acme.id, tom.email);
    const ashaSocket = await connect(url, asha.token);
    await Notification.deleteMany({}); // drop the invite notifications

    const message = await send(
      ashaSocket,
      general.id,
      `${mentionToken(asha.id)} ${mentionToken(ravi.id)}`,
    );
    await eventually(async () => expect(await Notification.countDocuments()).toBe(1));

    await emit(ashaSocket, 'message:edit', {
      messageId: message.id,
      body: `${mentionToken(ravi.id)} and ${mentionToken(tom.id)}`,
    });
    await eventually(async () => expect(await Notification.countDocuments()).toBe(2));
    await wait(100);
    const rows = await Notification.find().lean();
    expect(rows.map((r) => r.userId.toString()).sort()).toEqual([ravi.id, tom.id].sort());
  });

  it('never notifies someone outside a private channel', async () => {
    const { url, asha, ravi, acme } = await setup();
    const secret = (await createChannel(app, asha.token, acme.id, 'secret', true)).body.channel;
    const ashaSocket = await connect(url, asha.token);
    await Notification.deleteMany({});
    await send(ashaSocket, secret.id, `psst ${mentionToken(ravi.id)}`);
    await wait(150);
    expect(await Notification.countDocuments()).toBe(0);
  });
});

describe('GET /api/notifications and POST /api/notifications/read', () => {
  async function seed(userId: string, count: number) {
    for (let i = 0; i < count; i++) {
      await Notification.create({
        userId,
        type: 'system',
        payload: { title: `n${i}`, body: 'hello' },
      });
    }
  }

  it('pages newest first with a cursor and reports unreadCount', async () => {
    const ravi = await makeUser(app, 'Ravi');
    await seed(ravi.id, 25);

    const first = await request(app).get('/api/notifications?limit=20').set(auth(ravi.token));
    expect(first.status).toBe(200);
    const page = notificationsPageSchema.parse(first.body);
    expect(page.notifications).toHaveLength(20);
    expect(page.unreadCount).toBe(25);
    expect(page.notifications[0]!.type === 'system' && page.notifications[0]!.payload.title).toBe(
      'n24',
    );

    const second = await request(app)
      .get(`/api/notifications?before=${page.nextCursor}`)
      .set(auth(ravi.token));
    expect(second.body.notifications).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
  });

  it('marks some or all read, only for the caller', async () => {
    const ravi = await makeUser(app, 'Ravi');
    const zed = await makeUser(app, 'Zed');
    await seed(ravi.id, 3);
    await seed(zed.id, 2);
    const mine = await Notification.find({ userId: ravi.id }).lean();
    const zeds = await Notification.find({ userId: zed.id }).lean();

    const some = await request(app)
      .post('/api/notifications/read')
      .set(auth(ravi.token))
      .send({ ids: [mine[0]!._id.toString(), zeds[0]!._id.toString()] });
    expect(some.status).toBe(200);
    expect(some.body).toEqual({ unreadCount: 2 });
    expect(await Notification.countDocuments({ userId: zed.id, readAt: null })).toBe(2);

    const all = await request(app)
      .post('/api/notifications/read')
      .set(auth(ravi.token))
      .send({ all: true });
    expect(all.body).toEqual({ unreadCount: 0 });

    const bad = await request(app)
      .post('/api/notifications/read')
      .set(auth(ravi.token))
      .send({ all: false });
    expect(bad.status).toBe(400);
  });
});

describe('log redaction', () => {
  it('never logs the stream ticket', () => {
    expect(redactUrl('/api/notifications/stream?ticket=s3cret&lastEventId=abc')).toBe(
      '/api/notifications/stream?ticket=[REDACTED]&lastEventId=abc',
    );
    expect(redactUrl('/api/notifications')).toBe('/api/notifications');
  });
});
