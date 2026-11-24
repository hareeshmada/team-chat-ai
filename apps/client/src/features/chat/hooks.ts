import { SOCKET_EVENTS } from '@teamchat/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { queryClient } from '../../lib/queryClient';
import { socket } from '../../lib/socket';
import { useAuthStore } from '../../stores/auth';
import { useConnectionStore } from '../../stores/connection';
import { cachedMessageIds, mergeFreshPage, trimToNewestPage } from './messageCache';
import { fetchMessagesPage, queryKeys } from './queries';

/**
 * Loads the newest page and merges it: adds what we don't have yet and refreshes what we do
 * (edits, deletes and reactions we missed). Returns how many messages were missing.
 * If the whole page is new, there may be a gap beyond it: reload the history from the newest
 * page instead of showing a hole.
 */
async function catchUp(channelId: string): Promise<number> {
  const known = cachedMessageIds(channelId);
  if (known.size === 0) return 0; // history not loaded yet: its own fetch is current
  const page = await fetchMessagesPage(channelId);
  const missingCount = page.messages.filter((m) => !known.has(m.id)).length;
  if (missingCount === page.messages.length && page.nextCursor) {
    await queryClient.resetQueries({ queryKey: queryKeys.messages(channelId) });
    return missingCount;
  }
  const missing = new Set(mergeFreshPage(channelId, page));
  // Your own messages (queued while offline, sent on reconnect) are never "missed".
  const me = useAuthStore.getState().user?.id;
  return page.messages.filter((m) => missing.has(m.id) && m.authorId !== me).length;
}

/**
 * Keeps this socket in the channel's room while the channel is open (rooms are forgotten on
 * every reconnect, so it re-joins on each 'connect'). After a REconnect it loads the messages
 * sent while we were away (and refreshes edited ones) and reports them for the "Back online"
 * banner. Coming back to a channel also refreshes its cached newest page.
 * After the first join it also catches up silently: a message sent between the history fetch
 * and the join would otherwise be missed.
 */
export function useChannelRoom(channelId: string): void {
  useEffect(() => {
    let joinedOnce = false;

    const join = () => {
      const isReconnect = joinedOnce;
      joinedOnce = true;
      socket.emit(SOCKET_EVENTS.channelJoin, { channelId }, (res) => {
        if (!res.ok) return;
        void catchUp(channelId)
          .then((missed) => {
            if (isReconnect) useConnectionStore.getState().setBackOnline(missed);
          })
          .catch(() => {});
      });
    };

    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      if (socket.connected) socket.emit(SOCKET_EVENTS.channelLeave, { channelId }, () => {});
      // Out of the room = no more edits/reactions for it: don't keep history that goes stale.
      trimToNewestPage(channelId);
    };
  }, [channelId]);
}

/** Online user ids in a workspace: presence:list on every (re)connect, then presence:update. */
export function usePresence(workspaceId: string): Set<string> {
  const [online, setOnline] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false; // the shell is keyed by workspace, so this starts empty per workspace

    const load = () => {
      socket.emit(SOCKET_EVENTS.presenceList, { workspaceId }, (res) => {
        if (!cancelled && res.ok) setOnline(new Set(res.userIds));
      });
    };
    const onUpdate = ({
      workspaceId: ws,
      userId,
      online: isOnline,
    }: {
      workspaceId: string;
      userId: string;
      online: boolean;
    }) => {
      if (ws !== workspaceId) return;
      setOnline((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
      // Someone we don't know yet (just invited): refresh the member list.
      const members = queryClient.getQueryData<{ userId: string }[]>(
        queryKeys.members(workspaceId),
      );
      if (members && !members.some((m) => m.userId === userId)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) });
      }
    };

    if (socket.connected) load();
    socket.on('connect', load);
    socket.on(SOCKET_EVENTS.presenceUpdate, onUpdate);
    return () => {
      cancelled = true;
      socket.off('connect', load);
      socket.off(SOCKET_EVENTS.presenceUpdate, onUpdate);
    };
  }, [workspaceId]);

  return online;
}

/** Clears someone's indicator this long after their last typing:start (or at once on stop). */
export const TYPING_CLEAR_MS = 3_000;
/** Send typing:start at most this often (matches the server throttle). */
export const TYPING_EMIT_EVERY_MS = 2_000;

/** Who is typing in this channel right now (excluding you: the server never echoes it back). */
export function useTypingUsers(channelId: string): string[] {
  const [typing, setTyping] = useState<string[]>([]);

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>(); // keyed per channel by the caller

    const stop = (userId: string) => {
      clearTimeout(timers.get(userId));
      timers.delete(userId);
      setTyping((prev) => prev.filter((id) => id !== userId));
    };
    const onUpdate = ({
      channelId: ch,
      userId,
      isTyping,
    }: {
      channelId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (ch !== channelId) return;
      if (!isTyping) return stop(userId);
      clearTimeout(timers.get(userId));
      timers.set(
        userId,
        setTimeout(() => stop(userId), TYPING_CLEAR_MS),
      );
      setTyping((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    };

    socket.on(SOCKET_EVENTS.typingUpdate, onUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.typingUpdate, onUpdate);
      timers.forEach(clearTimeout);
    };
  }, [channelId]);

  return typing;
}

/**
 * For the composer: call onType() on every keystroke. Sends typing:start at most every 2 s and
 * typing:stop after 3 s without typing; stop() sends it now (on send or when the box is empty).
 */
export function useTypingEmitter(channelId: string) {
  const lastStart = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stop = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (lastStart.current === 0) return;
    lastStart.current = 0;
    if (socket.connected) socket.emit(SOCKET_EVENTS.typingStop, { channelId });
  }, [channelId]);

  const onType = useCallback(() => {
    const now = Date.now();
    if (now - lastStart.current >= TYPING_EMIT_EVERY_MS && socket.connected) {
      lastStart.current = now;
      socket.emit(SOCKET_EVENTS.typingStart, { channelId });
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stop, TYPING_CLEAR_MS);
  }, [channelId, stop]);

  useEffect(() => stop, [stop]); // leaving the channel = stopped typing there
  return { onType, stop };
}
