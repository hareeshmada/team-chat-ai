import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type * as GenAI from '@google/genai';
import { ApiError } from '@google/genai';
import { AI_CONVERSATION_HEADER } from '@teamchat/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AiConversation } from '../src/models/AiConversation.js';
import { aiConfig } from '../src/services/ai.service.js';
import { AI_HISTORY_LIMIT } from '../src/services/aiConversation.service.js';
import { auth, makeUser } from './helpers/workspace.js';

/**
 * The Gemini SDK is replaced with a fake: tests never call the real API. `generate` plays the
 * part of models.generateContentStream; each test scripts what it streams.
 */
interface FakeParams {
  contents: { role: string; parts: { text: string }[] }[];
  config: { systemInstruction: string; abortSignal: AbortSignal };
}
const fake = vi.hoisted(() => ({
  generate: undefined as unknown as (params: FakeParams) => Promise<AsyncGenerator<unknown>>,
  calls: [] as FakeParams[],
}));

vi.mock('@google/genai', async (importOriginal) => {
  const real = await importOriginal<typeof GenAI>();
  class GoogleGenAI {
    models = {
      generateContentStream: (params: FakeParams) => {
        fake.calls.push(params);
        return fake.generate(params);
      },
    };
  }
  return { ...real, GoogleGenAI };
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise<never>(() => {});
const usageChunk = {
  text: undefined,
  usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 30, thoughtsTokenCount: 4 },
};

/** Streams `pieces` (optionally spaced out), then usage; `hang` stalls after the pieces. */
function script(pieces: string[], opts: { delayMs?: number; hang?: boolean } = {}) {
  fake.generate = async () =>
    (async function* () {
      for (const text of pieces) {
        if (opts.delayMs) await sleep(opts.delayMs);
        yield { text };
      }
      if (opts.hang) await never();
      yield usageChunk;
    })();
}

const app = createApp();
const defaults = { ...aiConfig };

beforeEach(() => {
  fake.calls = [];
  script(['Hello', ', ', 'world.']);
});

afterEach(() => {
  Object.assign(aiConfig, defaults);
});

const ask = (token: string, body: object) =>
  request(app).post('/api/ai/chat').set(auth(token)).send(body);

describe('POST /api/ai/chat', () => {
  it('streams the answer as text/plain and saves the exchange', async () => {
    const { token } = await makeUser(app, 'Asha');
    const res = await ask(token, { message: '  Say hello  ' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.headers['cache-control']).toBe('no-cache, no-transform');
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(res.headers['transfer-encoding']).toBe('chunked');
    expect(res.text).toBe('Hello, world.');

    const id = res.headers[AI_CONVERSATION_HEADER.toLowerCase()] as string;
    const saved = await AiConversation.findById(id).lean();
    expect(saved?.title).toBe('Say hello');
    expect(saved?.messages.map((m) => [m.role, m.content, m.stopped])).toEqual([
      ['user', 'Say hello', undefined],
      ['assistant', 'Hello, world.', undefined],
    ]);

    // The system prompt goes separately; the question is the only turn.
    const call = fake.calls[0]!;
    expect(call.config.systemInstruction).toMatch(/TeamChat AI/);
    expect(call.contents).toEqual([{ role: 'user', parts: [{ text: 'Say hello' }] }]);
  });

  it('sends earlier messages as history on a follow-up (Gemini roles, last 20 only)', async () => {
    const { token, id: userId } = await makeUser(app, 'Asha');
    const first = await ask(token, { message: 'Q1' });
    const conversationId = first.headers[AI_CONVERSATION_HEADER.toLowerCase()] as string;

    const followUp = await ask(token, { conversationId, message: 'Q2' });
    expect(followUp.status).toBe(200);
    expect(followUp.headers[AI_CONVERSATION_HEADER.toLowerCase()]).toBe(conversationId);
    expect(fake.calls[1]!.contents).toEqual([
      { role: 'user', parts: [{ text: 'Q1' }] },
      { role: 'model', parts: [{ text: 'Hello, world.' }] },
      { role: 'user', parts: [{ text: 'Q2' }] },
    ]);

    // A long conversation sends only the newest AI_HISTORY_LIMIT messages + the new question.
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `m${i}`,
    }));
    await AiConversation.updateOne({ _id: conversationId }, { $set: { messages } });
    await ask(token, { conversationId, message: 'Q3' });
    const contents = fake.calls[2]!.contents;
    expect(contents).toHaveLength(AI_HISTORY_LIMIT + 1);
    expect(contents[0]!.parts[0]!.text).toBe('m10');
    expect(contents.at(-1)!.parts[0]!.text).toBe('Q3');

    expect(await AiConversation.countDocuments({ userId })).toBe(1);
  });

  it("returns 404 for someone else's conversation (and for unknown ids)", async () => {
    const owner = await makeUser(app, 'Owner');
    const other = await makeUser(app, 'Other');
    const first = await ask(owner.token, { message: 'mine' });
    const conversationId = first.headers[AI_CONVERSATION_HEADER.toLowerCase()] as string;

    const res = await ask(other.token, { conversationId, message: 'let me in' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONVERSATION_NOT_FOUND');

    const unknown = await ask(owner.token, {
      conversationId: '0123456789abcdef01234567',
      message: 'x',
    });
    expect(unknown.status).toBe(404);
    expect(fake.calls).toHaveLength(1); // neither reached the provider
  });

  it('requires auth and a valid body', async () => {
    expect((await request(app).post('/api/ai/chat').send({ message: 'hi' })).status).toBe(401);
    const { token } = await makeUser(app, 'Asha');
    for (const body of [{}, { message: '   ' }, { message: 'x'.repeat(4001) }]) {
      const res = await ask(token, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const badId = await ask(token, { conversationId: 'nope', message: 'hi' });
    expect(badId.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it('turns a provider 429 (quota) into a clean JSON 429 and saves nothing', async () => {
    fake.generate = () => Promise.reject(new ApiError({ message: 'quota exceeded', status: 429 }));
    const { token } = await makeUser(app, 'Asha');
    const res = await ask(token, { message: 'hi' });
    expect(res.status).toBe(429);
    expect(res.body.error).toEqual({
      code: 'AI_BUSY',
      message: 'The assistant is busy right now. Try again in a minute.',
    });
    expect(await AiConversation.countDocuments()).toBe(0);
  });

  it('turns a provider 503 (model overloaded) into 503 AI_BUSY', async () => {
    fake.generate = () => Promise.reject(new ApiError({ message: 'high demand', status: 503 }));
    const { token } = await makeUser(app, 'Asha');
    const res = await ask(token, { message: 'hi' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_BUSY');
  });

  it('turns other provider errors into 502 AI_ERROR', async () => {
    fake.generate = () =>
      Promise.reject(new ApiError({ message: 'API key not valid', status: 400 }));
    const { token } = await makeUser(app, 'Asha');
    const res = await ask(token, { message: 'hi' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/API key/); // provider details stay in the log
  });

  it('returns 504 AI_TIMEOUT when no text arrives in time', async () => {
    aiConfig.firstChunkTimeoutMs = 50;
    script([], { hang: true });
    const { token } = await makeUser(app, 'Asha');
    const res = await ask(token, { message: 'hi' });
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
    expect(fake.calls[0]!.config.abortSignal.aborted).toBe(true); // the request was cancelled
  });

  it('returns 502 AI_EMPTY when the model sends no text', async () => {
    script([]);
    const { token } = await makeUser(app, 'Asha');
    const res = await ask(token, { message: 'hi' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_EMPTY');
  });

  it('cuts the connection if the stream stalls after text was sent', async () => {
    aiConfig.idleTimeoutMs = 50;
    script(['partial'], { hang: true });
    const { token } = await makeUser(app, 'Asha');
    await expect(ask(token, { message: 'hi' })).rejects.toThrow(); // broken read, not a 200
    expect(await AiConversation.countDocuments()).toBe(0);
  });

  describe('client disconnect (real HTTP)', () => {
    let server: Server;
    afterEach(() => new Promise<void>((done) => server.close(() => done())));

    it('aborts the provider request and saves the partial answer as stopped', async () => {
      script(['First piece. ', 'Second piece. '], { hang: true });
      const { token } = await makeUser(app, 'Asha');
      server = app.listen(0);
      const { port } = server.address() as AddressInfo;

      const controller = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
        method: 'POST',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'long answer please' }),
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let received = '';
      while (!received.includes('Second piece.')) {
        const { value } = await reader.read();
        received += decoder.decode(value, { stream: true });
      }
      controller.abort(); // the user pressed Stop / closed the tab

      await vi.waitFor(async () => {
        expect(fake.calls[0]!.config.abortSignal.aborted).toBe(true);
        const saved = await AiConversation.findOne().lean();
        expect(saved?.messages.at(-1)).toMatchObject({
          role: 'assistant',
          content: 'First piece. Second piece. ',
          stopped: true,
        });
      });
    });
  });
});
