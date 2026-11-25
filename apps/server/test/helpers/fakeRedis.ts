/**
 * An in-memory stand-in for the few Redis commands the server uses (GET, and INCRBY + EXPIREAT
 * in a MULTI), so tests never need a Redis server. Installed for every test file by setup.ts.
 * `down = true` simulates Redis being unreachable (commands reject, like ioredis with
 * enableOfflineQueue: false).
 */
class FakeRedis {
  private store = new Map<string, { value: string; expireAt: number | null }>();
  down = false;

  private live(key: string) {
    const entry = this.store.get(key);
    if (entry?.expireAt !== null && entry && entry.expireAt * 1000 <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private check() {
    if (this.down)
      throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
  }

  async get(key: string): Promise<string | null> {
    this.check();
    return this.live(key)?.value ?? null;
  }

  /** Seconds until the key expires (-1 = no expiry, -2 = missing), like TTL. */
  ttl(key: string): number {
    const entry = this.live(key);
    if (!entry) return -2;
    if (entry.expireAt === null) return -1;
    return Math.ceil(entry.expireAt - Date.now() / 1000);
  }

  multi() {
    const ops: (() => [Error | null, unknown])[] = [];
    const chain = {
      incrby: (key: string, by: number) => {
        ops.push(() => {
          const entry = this.live(key);
          const value = Number(entry?.value ?? 0) + by;
          this.store.set(key, { value: String(value), expireAt: entry?.expireAt ?? null });
          return [null, value];
        });
        return chain;
      },
      expireat: (key: string, at: number) => {
        ops.push(() => {
          const entry = this.live(key);
          if (entry) entry.expireAt = at;
          return [null, entry ? 1 : 0];
        });
        return chain;
      },
      exec: async () => {
        this.check();
        return ops.map((op) => op());
      },
    };
    return chain;
  }

  reset() {
    this.store.clear();
    this.down = false;
  }

  async quit() {}
  disconnect() {}
}

export const fakeRedis = new FakeRedis();
