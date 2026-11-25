import { aiUsageSchema, type AiUsage } from '@teamchat/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { formatTime } from '../chat/format';

/**
 * Today's AI tokens (Step 4.4): GET /api/ai/usage once, then kept current by the `ai:usage`
 * socket event (after any AI call you make, in any tab) and by 429 AI_LIMIT_REACHED details.
 */
export const aiUsageKey = ['ai-usage'] as const;

export function useAiUsage() {
  const query = useQuery({
    queryKey: aiUsageKey,
    queryFn: ({ signal }) => api('/ai/usage', { signal }, aiUsageSchema),
    staleTime: Infinity,
  });
  // At the reset (midnight) the allowance starts again: fetch the fresh numbers then.
  const resetAt = query.data?.resetAt;
  useEffect(() => {
    if (!resetAt) return;
    const ms = new Date(resetAt).getTime() - Date.now() + 1_000;
    const timer = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: aiUsageKey }),
      Math.max(ms, 1_000),
    );
    return () => clearTimeout(timer);
  }, [resetAt]);
  return query;
}

export function setAiUsage(usage: AiUsage): void {
  queryClient.setQueryData(aiUsageKey, usage);
}

/** A 429's details carry the usage: apply them if they parse. */
export function setAiUsageFromError(details: unknown): void {
  const parsed = aiUsageSchema.safeParse(details);
  if (parsed.success) setAiUsage(parsed.data);
}

export const isOverLimit = (u: AiUsage | undefined) =>
  Boolean(u && !u.degraded && u.used >= u.limit);

/** "12,400" */
export const formatTokens = (n: number) => n.toLocaleString('en-US');

/** "12.4k" / "50k" / "900" (the sidebar's short form). */
export function compactTokens(n: number): string {
  if (n < 1_000) return String(n);
  const k = n / 1_000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** "in 6 h 12 m" until the reset. */
export function resetIn(resetAt: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.ceil((new Date(resetAt).getTime() - now) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `in ${h} h ${m} m` : `in ${m} m`;
}

/** "midnight" when the reset is at 00:00 your time, otherwise the clock time ("05:30"). */
export function resetClock(resetAt: string): string {
  const time = formatTime(resetAt);
  return time === '00:00' ? 'midnight' : time;
}
