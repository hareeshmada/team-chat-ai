import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@teamchat/shared';
import type { Express } from 'express';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createSocketServer, type SocketServerOptions } from '../../src/socket/index.js';
import type { IoServer } from '../../src/socket/types.js';

/** Shared by the socket test files: a real server on a free port + typed clients. */
export type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

let httpServer: HttpServer | undefined;
let io: IoServer | undefined;
const clients: Client[] = [];

/** A real HTTP + Socket.IO server on a random free port. */
export async function startServer(app: Express, options?: SocketServerOptions): Promise<string> {
  httpServer = createServer(app);
  io = createSocketServer(httpServer, options);
  await new Promise<void>((resolve) => httpServer!.listen(0, resolve));
  return `http://localhost:${(httpServer.address() as AddressInfo).port}`;
}

/** Call from afterEach: disconnects every client and closes the server. */
export async function stopServer(): Promise<void> {
  for (const c of clients.splice(0)) c.disconnect();
  await io?.close(); // also closes httpServer
  io = undefined;
  httpServer = undefined;
}

export const getIo = () => io;

/** Connected client, or rejects with the connect_error. */
export function connect(url: string, token?: string): Promise<Client> {
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
export function nextEvent<E extends keyof ServerToClientEvents>(
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
export function record<E extends keyof ServerToClientEvents>(socket: Client, event: E) {
  const seen: unknown[] = [];
  (socket.on as (e: string, cb: (p: unknown) => void) => void)(event, (p) => seen.push(p));
  return seen as Parameters<ServerToClientEvents[E]>[0][];
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Emits with an ack and resolves with the server's answer. */
export function request<T extends object = object>(
  socket: Client,
  event: Exclude<keyof ClientToServerEvents, 'typing:start' | 'typing:stop' | 'latency:ping'>,
  payload: unknown,
): Promise<Ack<T>> {
  return (socket.timeout(2_000).emitWithAck as (e: string, p: unknown) => Promise<Ack<T>>)(
    event,
    payload,
  );
}
