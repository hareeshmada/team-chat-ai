import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

/**
 * Fetches a user-supplied URL from the server without opening an SSRF hole (Step 5.2).
 *
 * SSRF (server-side request forgery): the link in a chat message is chosen by the user, but the
 * request comes from OUR machine, which can reach things the user can't: `localhost:6379`
 * (Redis), `10.0.0.5` (internal services), `169.254.169.254` (the cloud metadata endpoint that
 * hands out credentials). So:
 * 1. only http/https on ports 80/443, no `user:password@`;
 * 2. every IP we would connect to is checked against private/reserved ranges, and the check
 *    runs INSIDE the connection's DNS lookup, so the address that was checked is the address
 *    that is used (a "check first, fetch later" design can be beaten by DNS rebinding: the name
 *    resolves to a public IP for the check and to 127.0.0.1 a moment later for the fetch);
 * 3. redirects are followed by hand, and every hop goes through 1 and 2 again;
 * 4. 5 s for the whole thing, HTML only, at most 512 KB read.
 */

export class FetchError extends Error {
  /** false = trying again can't help (blocked address, 404, not HTML): the job gives up. */
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'FetchError';
    this.retryable = retryable;
  }
}

// --- which addresses are off limits ------------------------------------------------------

// Two lists: Node's BlockList treats an IPv4 address as ::ffff:a.b.c.d when it checks IPv6
// rules, so the ::ffff:0:0/96 rule below would refuse EVERY IPv4 address if they were shared.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. 169.254.169.254 cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, incl. 255.255.255.255
] as const) {
  blockedV4.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  // IPv4 inside IPv6 (::ffff:127.0.0.1, NAT64, 6to4, Teredo): could hide any v4 address,
  // and no public site needs them, so the whole ranges are refused.
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['2002::', 16],
  ['2001::', 32],
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local (private)
  ['fe80::', 10], // link-local
  ['fec0::', 10], // old site-local
  ['ff00::', 8], // multicast
] as const) {
  blockedV6.addSubnet(net, prefix, 'ipv6');
}

/** True when `ip` is a public unicast address the server may connect to. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return false;
  return family === 4 ? !blockedV4.check(ip, 'ipv4') : !blockedV6.check(ip, 'ipv6');
}

// --- the fetch ---------------------------------------------------------------------------

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Which resolved IPs may be connected to. Tests widen it to reach a local test server. */
  allowAddress?: (ip: string) => boolean;
  /** Which ports URLs may use. Tests add their local server's port. */
  allowPort?: (port: number) => boolean;
}

export interface FetchedPage {
  /** Where the page really came from (after redirects). */
  url: URL;
  html: string;
}

const USER_AGENT = 'TeamChatAI-LinkPreview/1.0 (+link previews in chat)';

/** Port 80/443 only: other ports are where internal services (Redis, Mongo, admin UIs) live. */
const standardPort = (port: number) => port === 80 || port === 443;

function checkUrl(raw: string | URL, allowPort: (port: number) => boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError('invalid URL', false);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchError('only http and https links are fetched', false);
  }
  if (url.username || url.password)
    throw new FetchError('URLs with credentials are refused', false);
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!allowPort(port)) throw new FetchError('port not allowed', false);
  return url;
}

/**
 * A `lookup` for http.request: resolves the name, refuses it if ANY of its addresses is
 * blocked, otherwise hands the checked addresses to the socket. Node connects to what this
 * returns, so there's no second, unchecked DNS lookup.
 */
function guardedLookup(allowAddress: (ip: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0);
      if (addresses.length === 0 || addresses.some((a) => !allowAddress(a.address))) {
        return callback(
          Object.assign(new Error('address not allowed'), { code: 'EBLOCKED' }),
          '',
          0,
        );
      }
      if (options.all) return callback(null, addresses);
      callback(null, addresses[0]!.address, addresses[0]!.family);
    });
  };
}

/** Bytes → text with the charset from Content-Type (UTF-8 when missing or unknown). */
function decode(body: Buffer, contentType: string): string {
  const charset = /charset\s*=\s*"?([\w-]+)/i.exec(contentType)?.[1];
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

type Hop = { redirect: URL } | { page: FetchedPage };

/** One request. Resolves with a redirect target or the page; rejects with FetchError. */
function requestOnce(
  url: URL,
  signal: AbortSignal,
  maxBytes: number,
  allowAddress: (ip: string) => boolean,
): Promise<Hop> {
  return new Promise((resolve, reject) => {
    // An IP in the URL itself (http://127.0.0.1/, http://[::1]/) never goes through `lookup`.
    const literal = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(literal) && !allowAddress(literal)) {
      reject(new FetchError('address not allowed', false));
      return;
    }

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'GET',
      signal,
      lookup: guardedLookup(allowAddress),
      agent: false, // no pooled sockets: every connection goes through the guarded lookup
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        // No gzip: a small compressed body could expand to gigabytes (a "zip bomb").
        'accept-encoding': 'identity',
      },
    });

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err instanceof FetchError) return reject(err);
      if (err.code === 'EBLOCKED') return reject(new FetchError('address not allowed', false));
      if (err.name === 'AbortError') return reject(new FetchError('timed out', true));
      // The name doesn't exist: asking again in a few seconds won't change that.
      if (err.code === 'ENOTFOUND') return reject(new FetchError('host not found', false));
      reject(new FetchError(`request failed (${err.code ?? err.message})`, true));
    });

    req.on('response', (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.destroy();
        try {
          resolve({ redirect: new URL(res.headers.location, url) });
        } catch {
          reject(new FetchError('bad redirect', false));
        }
        return;
      }
      if (status < 200 || status >= 300) {
        res.destroy();
        // 429 and 5xx may pass; any other 4xx (404, 403, 410…) won't.
        const retryable = status === 429 || status >= 500;
        reject(new FetchError(`HTTP ${status}`, retryable));
        return;
      }
      const contentType = String(res.headers['content-type'] ?? '');
      if (!/^\s*(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
        res.destroy();
        reject(new FetchError('not an HTML page', false));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve({ page: { url, html: decode(Buffer.concat(chunks), contentType) } });
      };
      res.on('data', (chunk: Buffer) => {
        if (done) return;
        const room = maxBytes - size;
        chunks.push(room < chunk.length ? chunk.subarray(0, room) : chunk);
        size += Math.min(chunk.length, room);
        // The preview tags are in <head>, near the top: stop reading here, use what we have.
        if (size >= maxBytes) {
          finish();
          res.destroy();
        }
      });
      res.on('end', finish);
      // Closed before 'end' and before we had enough: timed out or the server hung up.
      res.on('error', () => {});
      res.on('close', () => {
        if (done) return;
        done = true;
        reject(new FetchError(signal.aborted ? 'timed out' : 'response cut off', true));
      });
    });

    req.end();
  });
}

/** GETs an HTML page under the rules above. Throws FetchError for anything it refuses. */
export async function safeFetchHtml(
  rawUrl: string,
  {
    timeoutMs = 5_000,
    maxBytes = 512 * 1024,
    maxRedirects = 3,
    allowAddress = isPublicAddress,
    allowPort = standardPort,
  }: SafeFetchOptions = {},
): Promise<FetchedPage> {
  // One deadline for the whole chain, redirects included.
  const signal = AbortSignal.timeout(timeoutMs);
  let url = checkUrl(rawUrl, allowPort);
  for (let hop = 0; ; hop++) {
    const result = await requestOnce(url, signal, maxBytes, allowAddress);
    if ('page' in result) return result.page;
    if (hop >= maxRedirects) throw new FetchError('too many redirects', false);
    url = checkUrl(result.redirect, allowPort);
  }
}
