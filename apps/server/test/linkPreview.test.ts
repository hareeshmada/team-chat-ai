import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { findLinks, firstLink, type PublicMessage } from '@teamchat/shared';
import { UnrecoverableError } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { processLinkPreview } from '../src/jobs/linkPreview.job.js';
import { enqueueLinkPreview } from '../src/jobs/queues.js';
import { parsePageMeta } from '../src/lib/htmlMeta.js';
import {
  FetchError,
  isPublicAddress,
  safeFetchHtml,
  type FetchedPage,
} from '../src/lib/safeFetch.js';
import { Message } from '../src/models/Message.js';
import { broadcastMessage } from '../src/socket/eventRelay.js';
import {
  connect,
  nextEvent,
  request,
  startServer,
  stopServer,
  wait,
  type Client,
} from './helpers/socket.js';
import { createWorkspace, invite, listChannels, makeUser } from './helpers/workspace.js';

const enqueue = vi.mocked(enqueueLinkPreview);
beforeEach(() => enqueue.mockClear());

describe('findLinks / firstLink (shared)', () => {
  it('finds http(s) links and trims sentence punctuation', () => {
    expect(firstLink('see https://a.dev/x.')).toBe('https://a.dev/x');
    expect(firstLink('(https://a.dev/x)')).toBe('https://a.dev/x');
    expect(firstLink('https://en.wikipedia.org/wiki/Node_(software), ok')).toBe(
      'https://en.wikipedia.org/wiki/Node_(software)',
    );
    expect(firstLink('"http://a.dev/?q=1&b=2"!')).toBe('http://a.dev/?q=1&b=2');
    expect(findLinks('a https://one.dev b http://two.dev/p?').map((l) => l.url)).toEqual([
      'https://one.dev',
      'http://two.dev/p',
    ]);
  });

  it('ignores text that is not a link', () => {
    expect(firstLink('no links, just a.dev and ftp://x.dev')).toBeNull();
    expect(firstLink('https://')).toBeNull();
    expect(firstLink(`https://a.dev/${'x'.repeat(2100)}`)).toBeNull();
  });
});

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '127.255.0.9',
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '64:ff9b::7f00:1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    'not-an-ip',
  ])('refuses %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '104.16.0.1', '2606:4700:4700::1111'])(
    'allows %s',
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
});

describe('parsePageMeta', () => {
  const page = new URL('https://blog.acme.dev/posts/1');

  it('prefers Open Graph tags, decodes entities and resolves a relative image', () => {
    const meta = parsePageMeta(
      `<html><head>
        <title>Fallback title</title>
        <meta content="How we cut render time &amp; memory" property="og:title">
        <meta property='og:description' content='Virtualized lists &#39;n&#39; more'>
        <meta property=og:image content="/img/cover.png">
      </head><body><meta property="og:title" content="ignored"></body></html>`,
      page,
    );
    expect(meta).toEqual({
      title: 'How we cut render time & memory',
      description: "Virtualized lists 'n' more",
      imageUrl: 'https://blog.acme.dev/img/cover.png',
    });
  });

  it('falls back to <title> and meta description; drops non-https images', () => {
    const meta = parsePageMeta(
      `<TITLE>  Retrying
        failing jobs </TITLE><meta name="Description" content="BullMQ docs">
       <meta property="og:image" content="http://insecure.dev/a.png">`,
      page,
    );
    expect(meta).toEqual({ title: 'Retrying failing jobs', description: 'BullMQ docs' });
  });

  it('returns null without a title, and caps long text', () => {
    expect(parsePageMeta('<p>hello</p>', page)).toBeNull();
    const meta = parsePageMeta(`<title>${'t'.repeat(500)}</title>`, page);
    expect(meta!.title).toHaveLength(200);
    expect(meta!.title.endsWith('…')).toBe(true);
  });
});

// --- safeFetchHtml against a real local HTTP server ----------------------------------------

let site: Server | undefined;
afterEach(async () => {
  site?.closeAllConnections();
  await new Promise((r) => (site ? site.close(r) : r(null)));
  site = undefined;
});

async function serve(handler: RequestListener): Promise<string> {
  site = createServer(handler);
  await new Promise<void>((r) => site!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
}

/** The test server is on 127.0.0.1 and a random port, so these tests widen the policy for it. */
const local = {
  allowAddress: (ip: string) => ip === '127.0.0.1' || isPublicAddress(ip),
  allowPort: () => true,
};

const html = (body: string) =>
  ((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
  }) satisfies RequestListener;

describe('safeFetchHtml', () => {
  it('fetches an HTML page and follows a redirect', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/old') {
        res.writeHead(301, { location: '/new' });
        return res.end();
      }
      html('<title>New place</title>')(req, res);
    });
    const page = await safeFetchHtml(`${base}/old`, local);
    expect(page.url.pathname).toBe('/new');
    expect(page.html).toContain('New place');
  });

  it('refuses loopback, private and metadata addresses with the default policy', async () => {
    const base = await serve(html('<title>internal</title>'));
    const port = new URL(base).port;
    for (const url of [
      base, // IP literal 127.0.0.1
      `http://localhost:${port}/`, // a name that resolves to loopback
      `http://[::1]:${port}/`,
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/',
    ]) {
      await expect(safeFetchHtml(url, { allowPort: () => true })).rejects.toMatchObject({
        message: 'address not allowed',
        retryable: false,
      });
    }
  });

  it('checks every redirect hop again', async () => {
    const base = await serve((_req, res) => {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
    });
    await expect(safeFetchHtml(base, local)).rejects.toThrow('address not allowed');
  });

  it('refuses other schemes, credentials and non-standard ports', async () => {
    await expect(safeFetchHtml('ftp://example.com/')).rejects.toThrow('only http and https');
    await expect(safeFetchHtml('https://u:p@example.com/')).rejects.toThrow('credentials');
    await expect(safeFetchHtml('http://example.com:6379/')).rejects.toThrow('port not allowed');
    const base = await serve((_req, res) => {
      res.writeHead(302, { location: 'http://example.com:8080/' });
      res.end();
    });
    await expect(safeFetchHtml(base, { allowAddress: local.allowAddress })).rejects.toThrow(
      'port not allowed',
    );
  });

  it('stops after 3 redirects', async () => {
    const base = await serve((req, res) => {
      res.writeHead(302, { location: `/r${Number(req.url!.slice(2) || 0) + 1}` });
      res.end();
    });
    await expect(safeFetchHtml(`${base}/r0`, local)).rejects.toThrow('too many redirects');
  });

  it('refuses non-HTML and classifies HTTP errors', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/pdf') {
        res.writeHead(200, { 'content-type': 'application/pdf' });
        return res.end('%PDF');
      }
      res.writeHead(req.url === '/gone' ? 404 : 503);
      res.end();
    });
    await expect(safeFetchHtml(`${base}/pdf`, local)).rejects.toMatchObject({
      message: 'not an HTML page',
      retryable: false,
    });
    await expect(safeFetchHtml(`${base}/gone`, local)).rejects.toMatchObject({
      message: 'HTTP 404',
      retryable: false,
    });
    await expect(safeFetchHtml(`${base}/busy`, local)).rejects.toMatchObject({
      message: 'HTTP 503',
      retryable: true,
    });
  });

  it('reads at most maxBytes', async () => {
    const base = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.write('<title>Big page</title>');
      res.end('x'.repeat(2 * 1024 * 1024));
    });
    const page = await safeFetchHtml(base, { ...local, maxBytes: 64 * 1024 });
    expect(page.html.length).toBe(64 * 1024);
    expect(page.html.startsWith('<title>Big page</title>')).toBe(true);
  });

  it('times out a server that never answers', async () => {
    const base = await serve(() => {}); // accepts, never responds
    const started = Date.now();
    await expect(safeFetchHtml(base, { ...local, timeoutMs: 300 })).rejects.toMatchObject({
      message: 'timed out',
      retryable: true,
    });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('decodes the charset from Content-Type', async () => {
    const base = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=iso-8859-1' });
      res.end(Buffer.from('<title>Caf\xe9</title>', 'latin1'));
    });
    expect((await safeFetchHtml(base, local)).html).toBe('<title>Café</title>');
  });
});

// --- the job and the live update ------------------------------------------------------------

const app = createApp();

async function setup() {
  const url = await startServer(app);
  const asha = await makeUser(app, 'Asha');
  const ravi = await makeUser(app, 'Ravi');
  const acme = await createWorkspace(app, asha.token);
  await invite(app, asha.token, acme.id, ravi.email);
  const general = (await listChannels(app, asha.token, acme.id)).body.channels[0] as { id: string };
  const ashaSocket = await connect(url, asha.token);
  const raviSocket = await connect(url, ravi.token);
  await request(raviSocket, 'channel:join', { channelId: general.id });
  return { general, ashaSocket, raviSocket };
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

const fakePage =
  (html: string, finalUrl?: string) =>
  async (url: string): Promise<FetchedPage> => ({ url: new URL(finalUrl ?? url), html });

const PAGE = `<meta property="og:title" content="How we cut chat render time by 90%">
  <meta property="og:description" content="Virtualized lists.">
  <meta property="og:image" content="https://blog.acme.dev/cover.png">`;

describe('link-preview job', () => {
  afterEach(stopServer);

  it('queues a job for the first link of a sent message, not for messages without one', async () => {
    const { general, ashaSocket } = await setup();
    const m = await send(ashaSocket, general.id, 'read https://blog.acme.dev/p and https://b.dev');
    await send(ashaSocket, general.id, 'no link here');
    await wait(20);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({ messageId: m.id, url: 'https://blog.acme.dev/p' });
  });

  it('saves the preview and the channel gets message:updated with it', async () => {
    const { general, ashaSocket, raviSocket } = await setup();
    const m = await send(ashaSocket, general.id, 'https://blog.acme.dev/p');
    const publish = vi.fn(async () => {});

    const result = await processLinkPreview(
      { messageId: m.id, url: 'https://blog.acme.dev/p' },
      { fetchPage: fakePage(PAGE, 'https://www.blog.acme.dev/p'), publish },
    );
    expect(result).toBe('saved');
    expect(publish).toHaveBeenCalledWith({ type: 'message:updated', messageId: m.id });

    // What the API's relay does when that event arrives:
    const updated = nextEvent(raviSocket, 'message:updated');
    await broadcastMessage(m.id);
    expect((await updated).message.linkPreview).toEqual({
      url: 'https://blog.acme.dev/p',
      domain: 'blog.acme.dev',
      title: 'How we cut chat render time by 90%',
      description: 'Virtualized lists.',
      imageUrl: 'https://blog.acme.dev/cover.png',
    });
  });

  it('is idempotent and skips deleted or edited messages', async () => {
    const { general, ashaSocket } = await setup();
    const publish = vi.fn(async () => {});
    const deps = { fetchPage: fakePage(PAGE), publish };
    const url = 'https://blog.acme.dev/p';

    const m = await send(ashaSocket, general.id, url);
    await processLinkPreview({ messageId: m.id, url }, deps);
    expect(await processLinkPreview({ messageId: m.id, url }, deps)).toBe('already-saved');

    const edited = await send(ashaSocket, general.id, url);
    await request(ashaSocket, 'message:edit', { messageId: edited.id, body: 'https://other.dev' });
    expect(await processLinkPreview({ messageId: edited.id, url }, deps)).toBe('stale');

    const deleted = await send(ashaSocket, general.id, url);
    await request(ashaSocket, 'message:delete', { messageId: deleted.id });
    expect(await processLinkPreview({ messageId: deleted.id, url }, deps)).toBe('stale');

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('pages without a title get no card; unrecoverable fetch errors skip the retry', async () => {
    const { general, ashaSocket } = await setup();
    const url = 'https://blog.acme.dev/p';
    const m = await send(ashaSocket, general.id, url);
    const publish = vi.fn(async () => {});

    expect(
      await processLinkPreview(
        { messageId: m.id, url },
        { fetchPage: fakePage('<p>x</p>'), publish },
      ),
    ).toBe('no-preview');

    const blocked = async (): Promise<FetchedPage> => {
      throw new FetchError('address not allowed', false);
    };
    await expect(
      processLinkPreview({ messageId: m.id, url }, { fetchPage: blocked, publish }),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    const flaky = async (): Promise<FetchedPage> => {
      throw new FetchError('timed out', true);
    };
    const err = await processLinkPreview(
      { messageId: m.id, url },
      { fetchPage: flaky, publish },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect(err).not.toBeInstanceOf(UnrecoverableError);
    expect(publish).not.toHaveBeenCalled();
  });

  it('an edit that changes the link removes the old preview and queues the new link', async () => {
    const { general, ashaSocket } = await setup();
    const url = 'https://blog.acme.dev/p';
    const m = await send(ashaSocket, general.id, `look ${url}`);
    await processLinkPreview(
      { messageId: m.id, url },
      { fetchPage: fakePage(PAGE), publish: vi.fn() },
    );
    enqueue.mockClear();

    // Same link, different words: the preview stays, nothing queued.
    const same = await request<{ message: PublicMessage }>(ashaSocket, 'message:edit', {
      messageId: m.id,
      body: `look at ${url}`,
    });
    expect(same.ok && same.message.linkPreview?.title).toBe('How we cut chat render time by 90%');
    expect(enqueue).not.toHaveBeenCalled();

    const changed = await request<{ message: PublicMessage }>(ashaSocket, 'message:edit', {
      messageId: m.id,
      body: 'now https://docs.bullmq.io',
    });
    expect(changed.ok && changed.message.linkPreview).toBeUndefined();
    expect(enqueue).toHaveBeenCalledWith({ messageId: m.id, url: 'https://docs.bullmq.io' });

    // Removing the link entirely: no preview, no job.
    enqueue.mockClear();
    await request(ashaSocket, 'message:edit', { messageId: m.id, body: 'no link' });
    expect((await Message.findById(m.id).lean())!.linkPreview).toBeUndefined();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
