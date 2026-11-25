import { AI_LIMIT_REACHED, type AiFeature, type AiUsage as AiUsageSummary } from '@teamchat/shared';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { getRedis } from '../lib/redis.js';
import { dayKey, nextMidnight } from '../lib/zonedDay.js';
import { AiUsage } from '../models/AiUsage.js';
import type { AiTurn, TokenMeter } from './ai.service.js';

/**
 * Per-user daily AI token limit (Step 4.4).
 *
 * - The counter lives in Redis under `ai:usage:<userId>:<day>` (day in AI_USAGE_TIMEZONE).
 * - BEFORE a call: `assertWithinLimit` (one GET). The real token count is only known after the
 *   answer, so the check is "under the limit now"; the last answer may end a little over it,
 *   and the next request is refused. (Stricter alternative: reserve an estimate up front and
 *   settle it afterwards.)
 * - AFTER a call: `recordUsage` adds the tokens with INCRBY (atomic, so two tabs asking at once
 *   can't lose a count) and EXPIREAT next midnight (yesterday's key deletes itself) in one
 *   MULTI, and saves an AiUsage row in MongoDB (the permanent record).
 * - Redis down: fail open (agreed): AI keeps working, the limit isn't enforced, a warning is
 *   logged, and the usage reads as `degraded`.
 */

/** Mutable so tests can use a tiny limit. */
export const aiUsageConfig = { dailyLimit: env.AI_DAILY_TOKEN_LIMIT };

const usageKey = (userId: string, at: Date) =>
  `ai:usage:${userId}:${dayKey(at, env.AI_USAGE_TIMEZONE)}`;

let lastWarn = 0;
function warnDegraded(err: unknown) {
  if (Date.now() - lastWarn < 60_000) return;
  lastWarn = Date.now();
  logger.warn(
    { err: err instanceof Error ? err.message : err },
    'AI usage limit unavailable (Redis down): not enforced',
  );
}

export async function getUsage(userId: string, now = new Date()): Promise<AiUsageSummary> {
  const resetAt = nextMidnight(now, env.AI_USAGE_TIMEZONE).toISOString();
  const limit = aiUsageConfig.dailyLimit;
  try {
    const raw = await getRedis().get(usageKey(userId, now));
    return { used: Number(raw ?? 0), limit, resetAt };
  } catch (err) {
    warnDegraded(err);
    return { used: 0, limit, resetAt, degraded: true };
  }
}

/** 429 AI_LIMIT_REACHED (details = the usage) once today's allowance is used up. */
export async function assertWithinLimit(userId: string): Promise<void> {
  const usage = await getUsage(userId);
  if (!usage.degraded && usage.used >= usage.limit) {
    throw new AppError(
      429,
      AI_LIMIT_REACHED,
      'You’ve used today’s AI allowance. It resets at midnight.',
      usage,
    );
  }
}

/** The browser and Gemini count differently; ~4 characters per token is the usual estimate. */
export const estimateTokens = (chars: number) => Math.ceil(chars / 4);

export interface UsageInput {
  userId: string;
  feature: AiFeature;
  inputTokens: number;
  outputTokens: number;
  estimated?: boolean;
}

/** Adds a call's tokens to today's counter and saves its AiUsage row. Returns the new totals. */
export async function recordUsage(input: UsageInput, now = new Date()): Promise<AiUsageSummary> {
  const tokens = input.inputTokens + input.outputTokens;
  const resetAt = nextMidnight(now, env.AI_USAGE_TIMEZONE);
  const row = AiUsage.create({
    userId: input.userId,
    feature: input.feature,
    model: env.AI_MODEL ?? 'unknown',
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimated: input.estimated ?? false,
  }).catch((err: unknown) => logger.error({ err }, 'saving AiUsage failed'));

  let summary: AiUsageSummary;
  try {
    const result = await getRedis()
      .multi()
      .incrby(usageKey(input.userId, now), tokens)
      .expireat(usageKey(input.userId, now), Math.ceil(resetAt.getTime() / 1000))
      .exec();
    const used = Number(result?.[0]?.[1] ?? tokens);
    summary = { used, limit: aiUsageConfig.dailyLimit, resetAt: resetAt.toISOString() };
  } catch (err) {
    warnDegraded(err);
    summary = {
      used: 0,
      limit: aiUsageConfig.dailyLimit,
      resetAt: resetAt.toISOString(),
      degraded: true,
    };
  }
  await row;
  return summary;
}

/**
 * The tokens to charge for a call: Gemini's own counts when it sent them; otherwise (stopped or
 * failed before any counts) an estimate from the prompt and the text that was produced. Nothing
 * produced and nothing reported → null (nothing to charge).
 */
export function tokensToCharge(
  meter: TokenMeter,
  prompt: { system: string; turns: AiTurn[] },
  answer: string,
): { inputTokens: number; outputTokens: number; estimated: boolean } | null {
  if (meter.reported) {
    return { inputTokens: meter.inputTokens, outputTokens: meter.outputTokens, estimated: false };
  }
  if (!answer) return null;
  const promptChars = prompt.system.length + prompt.turns.reduce((n, t) => n + t.content.length, 0);
  return {
    inputTokens: estimateTokens(promptChars),
    outputTokens: estimateTokens(answer.length),
    estimated: true,
  };
}
