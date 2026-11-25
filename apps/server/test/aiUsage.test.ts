import type * as GenAI from '@google/genai';
import {
  AI_BOT_ID,
  aiUsageSchema,
  type AiUsage as AiUsageSummary,
  type PublicMessage,
} from '@teamchat/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { dayKey, nextMidnight } from '../src/lib/zonedDay.js';
import { AiUsage } from '../src/models/AiUsage.js';
import { Message } from '../src/models/Message.js';
import { newTokenMeter } from '../src/services/ai.service.js';
import { aiUsageConfig, tokensToCharge } from '../src/services/aiUsage.service.js';
import { aiRepliesRunning } from '../src/socket/aiReply.js';
import { fakeRedis } from './helpers/fakeRedis.js';
import {
  connect,
  record,
  request as emit,
  startServer,
  stopServer,
  wait,
} from './helpers/socket.js';
import { auth, createWorkspace, listChannels, makeUser } from './helpers/workspace.js';

/** Fake Gemini (see ai.test.ts): each answer reports 12 input + 30 output + 4 thinking tokens. */
const fake = vi.hoisted(() => ({ calls: 0 }));
vi.mock('@google/genai', async (importOriginal) => {
  const real = await importOriginal<typeof GenAI>();
  class GoogleGenAI {
    models = {
      generateContentStream: async () => {
        fake.calls++;
        return (async function* () {
          yield {
            text: 'Hello.',
            usageMetadata: {
              promptTokenCount: 12,
              candidatesTokenCount: 30,
              thoughtsTokenCount: 4,
            },
          };
        })();
      },
    };
  }
  return { ...real, GoogleGenAI };
});

const PER_CALL = 12 + 30 + 4;
const app = createApp();
const defaultLimit = aiUsageConfig.dailyLimit;

beforeEach(() => {
  fake.calls = 0;
});

afterEach(async () => {
  aiUsageConfig.dailyLimit = defaultLimit;
  await vi.waitFor(() => expect(aiRepliesRunning()).toBe(0));
  await stopServer();
});

const ask = (token: string) =>
  request(app).post('/api/ai/chat').set(auth(token)).send({ message: 'hi' });
const usageOf = async (token: string): Promise<AiUsageSummary> =>
  aiUsageSchema.parse((await request(app).get('/api/ai/usage').set(auth(token))).body);

describe('AI usage tracking', () => {
  it('counts every answer in Redis (expiring at the reset) and saves an AiUsage row', async () => {
    const { token, id: userId } = await makeUser(app, 'Asha');
    expect(await usageOf(token)).toMatchObject({ used: 0, limit: defaultLimit });

    expect((await ask(token)).status).toBe(200);
    expect((await ask(token)).status).toBe(200);

    const usage = await usageOf(token);
    expect(usage.used).toBe(2 * PER_CALL);
    expect(usage.resetAt).toBe(nextMidnight(new Date(), 'UTC').toISOString());

    // The key deletes itself at the next midnight.
    const ttl = fakeRedis.ttl(`ai:usage:${userId}:${dayKey(new Date(), 'UTC')}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60);

    const rows = await AiUsage.find({ userId }).lean();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      feature: 'assistant',
      inputTokens: 12,
      outputTokens: 34, // thinking tokens are billed as output
      estimated: false,
    });
  });

  it('refuses with 429 AI_LIMIT_REACHED once the allowance is used (panel and summary)', async () => {
    aiUsageConfig.dailyLimit = PER_CALL + 1;
    const { token } = await makeUser(app, 'Asha');
    expect((await ask(token)).status).toBe(200); // 46 of 47
    expect((await ask(token)).status).toBe(200); // still under before it: 92 (one answer over)

    const blocked = await ask(token);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatchObject({
      code: 'AI_LIMIT_REACHED',
      details: { used: 2 * PER_CALL, limit: PER_CALL + 1 },
    });
    expect(fake.calls).toBe(2); // the blocked request never reached Gemini

    const acme = await createWorkspace(app, token);
    const general = (await listChannels(app, token, acme.id)).body.channels[0] as { id: string };
    const summary = await request(app).post(`/api/channels/${general.id}/summary`).set(auth(token));
    expect(summary.status).toBe(429);
    expect(summary.body.error.code).toBe('AI_LIMIT_REACHED');

    // Someone else's allowance is separate.
    const ravi = await makeUser(app, 'Ravi');
    expect((await ask(ravi.token)).status).toBe(200);
  });

  it('@ai: counts against the asker, updates their tabs, and at the limit posts no bot message', async () => {
    const url = await startServer(app);
    const asha = await makeUser(app, 'Asha');
    const acme = await createWorkspace(app, asha.token);
    const general = (await listChannels(app, asha.token, acme.id)).body.channels[0] as {
      id: string;
    };
    const socket = await connect(url, asha.token);
    await emit(socket, 'channel:join', { channelId: general.id });
    const usageEvents = record(socket, 'ai:usage');
    const failures = record(socket, 'ai:failed');
    const send = (body: string) =>
      emit<{ message: PublicMessage }>(socket, 'message:send', {
        channelId: general.id,
        body,
        tempId: `t-${Math.random()}`,
      });

    await send('@ai first question');
    await vi.waitFor(() => expect(usageEvents).toHaveLength(1));
    expect(usageEvents[0]).toMatchObject({ used: PER_CALL });
    expect(await AiUsage.countDocuments({ feature: 'channel' })).toBe(1);

    aiUsageConfig.dailyLimit = PER_CALL;
    const ack = await send('@ai second question');
    expect(ack.ok).toBe(true); // the message itself is still sent
    await vi.waitFor(() => expect(failures).toHaveLength(1));
    expect(failures[0]).toMatchObject({ messageId: null, error: { code: 'AI_LIMIT_REACHED' } });
    await wait(50);
    expect(await Message.countDocuments({ authorId: AI_BOT_ID })).toBe(1); // only the first answer
    expect(fake.calls).toBe(1);
  });

  it('fails open when Redis is down: AI still works, usage reads as degraded', async () => {
    aiUsageConfig.dailyLimit = 1;
    const { token } = await makeUser(app, 'Asha');
    fakeRedis.down = true;
    expect((await ask(token)).status).toBe(200);
    expect((await ask(token)).status).toBe(200);
    expect(await usageOf(token)).toMatchObject({ used: 0, degraded: true });
    expect(await AiUsage.countDocuments()).toBe(2); // the permanent record is still kept
  });

  it('requires auth', async () => {
    expect((await request(app).get('/api/ai/usage')).status).toBe(401);
  });
});

describe('tokensToCharge', () => {
  const prompt = {
    system: 'x'.repeat(40),
    turns: [{ role: 'user' as const, content: 'y'.repeat(40) }],
  };

  it("uses Gemini's counts when it reported them", () => {
    const meter = { inputTokens: 100, outputTokens: 20, reported: true };
    expect(tokensToCharge(meter, prompt, 'answer')).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      estimated: false,
    });
  });

  it('estimates (~4 chars per token) when stopped before any counts arrived', () => {
    expect(tokensToCharge(newTokenMeter(), prompt, 'z'.repeat(41))).toEqual({
      inputTokens: 20,
      outputTokens: 11,
      estimated: true,
    });
  });

  it('charges nothing when nothing was produced or reported', () => {
    expect(tokensToCharge(newTokenMeter(), prompt, '')).toBeNull();
  });
});

describe('zonedDay', () => {
  it('finds the next midnight in a timezone, across DST changes', () => {
    const at = (iso: string) => new Date(iso);
    expect(dayKey(at('2026-11-25T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-11-26');
    expect(nextMidnight(at('2026-11-25T06:10:00Z'), 'Asia/Kolkata').toISOString()).toBe(
      '2026-11-25T18:30:00.000Z',
    );
    // New York: DST starts 8 Mar 2026 (midnight is still EST) and ends 1 Nov (midnight is EDT).
    expect(nextMidnight(at('2026-03-07T12:00:00Z'), 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    expect(nextMidnight(at('2026-11-01T03:00:00Z'), 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
  });
});
