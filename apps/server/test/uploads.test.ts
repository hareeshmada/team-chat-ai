import { createHash } from 'node:crypto';
import {
  MAX_UPLOAD_BYTES,
  messagesPageSchema,
  uploadSignatureSchema,
  type PublicMessage,
} from '@teamchat/shared';
import { v2 as cloudinary } from 'cloudinary';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { Message } from '../src/models/Message.js';
import {
  connect,
  record,
  request as emit,
  startServer,
  stopServer,
  type Client,
} from './helpers/socket.js';
import { auth, createWorkspace, invite, listChannels, makeUser } from './helpers/workspace.js';

/**
 * Cloudinary's network calls are replaced: `api.resource` reads from this map (what "was
 * uploaded"), `uploader.destroy` is recorded. Signing is real (it's local: a SHA-1 hash).
 */
interface FakeResource {
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}
const uploaded = new Map<string, FakeResource>();
const destroyed: string[] = [];
let lookupFails = false;

beforeEach(() => {
  uploaded.clear();
  destroyed.length = 0;
  lookupFails = false;
  vi.spyOn(cloudinary.api, 'resource').mockImplementation((async (publicId: string) => {
    if (lookupFails) throw { error: { message: 'boom', http_code: 500 } };
    const r = uploaded.get(publicId);
    if (!r) throw { error: { message: 'Resource not found', http_code: 404 } };
    return {
      public_id: publicId,
      ...r,
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.${r.format}`,
    };
  }) as never);
  vi.spyOn(cloudinary.uploader, 'destroy').mockImplementation((async (publicId: string) => {
    destroyed.push(publicId);
    return { result: 'ok' };
  }) as never);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await stopServer();
});

const app = createApp();

const sign = (token: string | null, body: object) => {
  const req = request(app).post('/api/uploads/sign');
  if (token) req.set(auth(token));
  return req.send(body);
};

/** "Uploads" a file for the user: signs it, then pretends the browser sent it to Cloudinary. */
async function upload(token: string, file: FakeResource & { name?: string }) {
  const res = await sign(token, { name: file.name ?? 'x', type: 'image/png', size: 1000 });
  const { publicId } = uploadSignatureSchema.parse(res.body);
  uploaded.set(publicId, file);
  return publicId;
}

describe('POST /api/uploads/sign', () => {
  it('signs one upload into the user’s own folder (a signature Cloudinary can verify)', async () => {
    const { token, id } = await makeUser(app, 'Asha');
    const res = await sign(token, { name: 'shot.png', type: 'image/png', size: 5_000_000 });
    expect(res.status).toBe(200);
    const s = uploadSignatureSchema.parse(res.body);

    expect(s.uploadUrl).toBe('https://api.cloudinary.com/v1_1/test-cloud/image/upload');
    expect(s.apiKey).toBe('test-key');
    expect(s.publicId).toMatch(new RegExp(`^teamchat/${id}/[a-f0-9]{24}$`));
    expect(s.allowedFormats).toBe('png,jpg,gif,webp,pdf');
    expect(Math.abs(s.timestamp - Date.now() / 1000)).toBeLessThan(5);
    // Cloudinary's rule: sort the signed params, join as a=b&c=d, append the secret, SHA-1.
    const toSign = `allowed_formats=${s.allowedFormats}&overwrite=false&public_id=${s.publicId}&timestamp=${s.timestamp}`;
    expect(s.signature).toBe(
      createHash('sha1')
        .update(toSign + 'test-cloudinary-secret')
        .digest('hex'),
    );
    // The secret itself is never sent.
    expect(JSON.stringify(res.body)).not.toContain('test-cloudinary-secret');

    // A new id every time (two uploads can't overwrite each other).
    const again = await sign(token, { name: 'shot.png', type: 'image/png', size: 5 });
    expect(again.body.publicId).not.toBe(s.publicId);
  });

  it('rejects other types, files over 10 MB, and requests without auth', async () => {
    const { token } = await makeUser(app, 'Asha');
    const exe = await sign(token, { name: 'a.exe', type: 'application/x-msdownload', size: 10 });
    expect(exe.status).toBe(400);
    expect(exe.body.error.code).toBe('VALIDATION_ERROR');
    const big = await sign(token, { name: 'a.png', type: 'image/png', size: MAX_UPLOAD_BYTES + 1 });
    expect(big.status).toBe(400);
    expect((await sign(null, { name: 'a.png', type: 'image/png', size: 10 })).status).toBe(401);
  });
});

describe('message:send with attachments', () => {
  /** Asha and Ravi in #general, both connected. */
  async function setup() {
    const url = await startServer(app);
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token);
    await invite(app, asha.token, acme.id, ravi.email);
    const general = (await listChannels(app, asha.token, acme.id)).body.channels[0] as {
      id: string;
    };
    const ashaSocket = await connect(url, asha.token);
    const raviSocket = await connect(url, ravi.token);
    for (const s of [ashaSocket, raviSocket]) {
      await emit(s, 'channel:join', { channelId: general.id });
    }
    return { asha, ravi, general, ashaSocket, raviSocket };
  }

  const send = (
    socket: Client,
    channelId: string,
    attachments: { publicId: string; name: string }[],
    body = '',
  ) =>
    emit<{ message: PublicMessage }>(socket, 'message:send', {
      channelId,
      body,
      tempId: `t-${Math.random()}`,
      attachments,
    });

  it('stores what Cloudinary has (not what the client says) and shows it to everyone', async () => {
    const { asha, general, ashaSocket, raviSocket } = await setup();
    const news = record(raviSocket, 'message:new');
    const image = await upload(asha.token, {
      format: 'png',
      bytes: 412_000,
      width: 1600,
      height: 900,
    });
    const pdf = await upload(asha.token, {
      format: 'pdf',
      bytes: 1_800_000,
      width: 612,
      height: 792,
    });

    const ack = await send(
      ashaSocket,
      general.id,
      [
        { publicId: image, name: 'empty-state.png' },
        { publicId: pdf, name: 'report.pdf' },
      ],
      'Two files',
    );
    if (!ack.ok) throw new Error(ack.error.code);
    expect(ack.message.attachments).toEqual([
      {
        url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${image}.png`,
        kind: 'image',
        name: 'empty-state.png',
        mimeType: 'image/png',
        size: 412_000,
        width: 1600,
        height: 900,
      },
      {
        url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${pdf}.pdf`,
        kind: 'file',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 1_800_000,
      },
    ]);

    await vi.waitFor(() => expect(news).toHaveLength(1));
    expect(news[0]!.message.attachments).toHaveLength(2);

    const history = await request(app)
      .get(`/api/channels/${general.id}/messages`)
      .set(auth(asha.token));
    expect(messagesPageSchema.parse(history.body).messages[0]!.attachments).toHaveLength(2);
    // The Cloudinary id stays on the server.
    expect(JSON.stringify(history.body)).not.toContain('publicId');
  });

  it('allows a message that is only files, but not an empty one', async () => {
    const { asha, general, ashaSocket } = await setup();
    const id = await upload(asha.token, { format: 'jpg', bytes: 10, width: 1, height: 1 });
    const filesOnly = await send(ashaSocket, general.id, [{ publicId: id, name: 'a.jpg' }]);
    expect(filesOnly).toMatchObject({ ok: true, message: { body: '' } });

    const empty = await send(ashaSocket, general.id, [], '   ');
    expect(empty).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('refuses files from someone else’s folder, missing files, and more than 5', async () => {
    const { asha, general, ashaSocket, raviSocket } = await setup();
    const ashas = await upload(asha.token, { format: 'png', bytes: 10, width: 1, height: 1 });

    const stolen = await send(raviSocket, general.id, [{ publicId: ashas, name: 'a.png' }]);
    expect(stolen).toMatchObject({ ok: false, error: { code: 'ATTACHMENT_NOT_FOUND' } });
    expect(cloudinary.api.resource).not.toHaveBeenCalled(); // refused before asking Cloudinary

    const missing = await send(ashaSocket, general.id, [
      { publicId: `teamchat/${asha.id}/nope`, name: 'a.png' },
    ]);
    expect(missing).toMatchObject({ ok: false, error: { code: 'ATTACHMENT_NOT_FOUND' } });

    const six = Array.from({ length: 6 }, (_, i) => ({ publicId: `${ashas}${i}`, name: 'a.png' }));
    expect(await send(ashaSocket, general.id, six)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(await Message.countDocuments()).toBe(0);
  });

  it('refuses (and deletes) a file Cloudinary measured over 10 MB', async () => {
    const { asha, general, ashaSocket } = await setup();
    const big = await upload(asha.token, { format: 'png', bytes: MAX_UPLOAD_BYTES + 1 });
    const ack = await send(ashaSocket, general.id, [{ publicId: big, name: 'big.png' }]);
    expect(ack).toMatchObject({ ok: false, error: { code: 'FILE_TOO_LARGE' } });
    expect(destroyed).toEqual([big]);
  });

  it('a file can only be sent once; a Cloudinary outage is a clean error', async () => {
    const { asha, general, ashaSocket } = await setup();
    const id = await upload(asha.token, { format: 'gif', bytes: 10, width: 1, height: 1 });
    expect((await send(ashaSocket, general.id, [{ publicId: id, name: 'a.gif' }])).ok).toBe(true);
    expect(await send(ashaSocket, general.id, [{ publicId: id, name: 'a.gif' }])).toMatchObject({
      ok: false,
      error: { code: 'ATTACHMENT_ALREADY_SENT' },
    });

    lookupFails = true;
    const other = await upload(asha.token, { format: 'gif', bytes: 10 });
    expect(await send(ashaSocket, general.id, [{ publicId: other, name: 'b.gif' }])).toMatchObject({
      ok: false,
      error: { code: 'UPLOAD_CHECK_FAILED' },
    });
  });

  it('deleting the message deletes its files at Cloudinary (once)', async () => {
    const { asha, general, ashaSocket } = await setup();
    const id = await upload(asha.token, { format: 'webp', bytes: 10, width: 1, height: 1 });
    const ack = await send(ashaSocket, general.id, [{ publicId: id, name: 'a.webp' }]);
    if (!ack.ok) throw new Error(ack.error.code);

    const del = await emit<{ message: PublicMessage }>(ashaSocket, 'message:delete', {
      messageId: ack.message.id,
    });
    expect(del).toMatchObject({ ok: true, message: { attachments: [] } });
    await vi.waitFor(() => expect(destroyed).toEqual([id]));

    await emit(ashaSocket, 'message:delete', { messageId: ack.message.id });
    expect(destroyed).toEqual([id]); // the repeat delete is a no-op
  });
});

describe('POST /api/uploads/discard', () => {
  const discard = (token: string | null, publicIds: string[]) => {
    const req = request(app).post('/api/uploads/discard');
    if (token) req.set(auth(token));
    return req.send({ publicIds });
  };

  it('deletes your unsent files, never someone else’s or one already on a message', async () => {
    const url = await startServer(app);
    const asha = await makeUser(app, 'Asha');
    const ravi = await makeUser(app, 'Ravi');
    const acme = await createWorkspace(app, asha.token);
    const general = (await listChannels(app, asha.token, acme.id)).body.channels[0] as {
      id: string;
    };
    const unsent = await upload(asha.token, { format: 'png', bytes: 10, width: 1, height: 1 });
    const sent = await upload(asha.token, { format: 'png', bytes: 10, width: 1, height: 1 });
    const ravis = await upload(ravi.token, { format: 'png', bytes: 10, width: 1, height: 1 });

    const socket = await connect(url, asha.token);
    const ack = await emit(socket, 'message:send', {
      channelId: general.id,
      body: '',
      tempId: 't-1',
      attachments: [{ publicId: sent, name: 'sent.png' }],
    });
    expect(ack.ok).toBe(true);

    const res = await discard(asha.token, [unsent, sent, ravis]);
    expect(res.status).toBe(204);
    await vi.waitFor(() => expect(destroyed).toEqual([unsent]));
  });

  it('validates the body and requires auth', async () => {
    const { token } = await makeUser(app, 'Asha');
    expect((await discard(token, [])).status).toBe(400);
    expect((await discard(null, ['x'])).status).toBe(401);
  });
});
