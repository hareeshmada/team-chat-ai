/**
 * In-memory fixed-window counter for socket events (express-rate-limit only sees HTTP).
 * take(key) returns false once `limit` events happened in the current window.
 * One process only: with several instances this moves to Redis (Day 5).
 */
export function createSocketRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    take(key: string): boolean {
      const now = Date.now();
      const current = windows.get(key);
      if (!current || now >= current.resetAt) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      current.count++;
      return current.count <= limit;
    },
  };
}
