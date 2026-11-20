// Cross-tab auth sync. The access token lives in each tab's memory, so when one tab logs out
// the others must be told. BroadcastChannel delivers to every other same-origin tab (not the
// sender). Nothing secret is sent: only the event type.

type AuthMessage = { type: 'logout' };

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('tc-auth');

export function broadcastLogout(): void {
  channel?.postMessage({ type: 'logout' } satisfies AuthMessage);
}

/** Returns an unsubscribe function. */
export function onAuthMessage(handler: (message: AuthMessage) => void): () => void {
  if (!channel) return () => {};
  const listener = (event: MessageEvent<AuthMessage>) => handler(event.data);
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
