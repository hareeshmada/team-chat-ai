/**
 * Who is online, in this process's memory: userId → number of open sockets.
 * Counting sockets (not a Set of users) means a second tab doesn't announce "online" twice,
 * and closing one of two tabs doesn't mark the user offline.
 * With several server instances each one only knows its own sockets (fix: Redis, Day 5).
 */
export function createPresenceStore() {
  const sockets = new Map<string, number>();

  return {
    /** Returns true when this is the user's first socket (they just came online). */
    add(userId: string): boolean {
      const count = (sockets.get(userId) ?? 0) + 1;
      sockets.set(userId, count);
      return count === 1;
    },
    /** Returns true when this was the user's last socket (they just went offline). */
    remove(userId: string): boolean {
      const count = (sockets.get(userId) ?? 0) - 1;
      if (count <= 0) {
        sockets.delete(userId);
        return true;
      }
      sockets.set(userId, count);
      return false;
    },
    isOnline(userId: string): boolean {
      return sockets.has(userId);
    },
  };
}

export type PresenceStore = ReturnType<typeof createPresenceStore>;
