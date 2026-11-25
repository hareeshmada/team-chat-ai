import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { onAuthMessage } from './features/auth/broadcast';
import { restoreSession } from './features/auth/session';
import { startRealtimeSync } from './features/chat/realtime';
import { useNotificationStream } from './features/notifications/useNotificationStream';
import { queryClient } from './lib/queryClient';
import { startSocketLifecycle } from './lib/socket';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { usePendingStore } from './stores/pending';
import { useToastStore } from './stores/toasts';
import { useAiFailuresStore } from './stores/aiFailures';
import { resetAssistant } from './features/assistant/actions';

export function App() {
  // SSE notifications while signed in (closes on sign-out).
  useNotificationStream();

  useEffect(() => {
    // Memoised: StrictMode runs this effect twice in dev, but only one /auth/refresh is sent.
    void restoreSession();
    // Idempotent: the socket connects while signed in and disconnects on sign-out.
    startSocketLifecycle();
    startRealtimeSync();

    // Signed out (here, in another tab, or the session expired): drop the previous user's
    // cached data and unsent messages, so the next sign-in never sees them.
    const unsubscribe = useAuthStore.subscribe((state, prev) => {
      if (prev.status === 'authenticated' && state.status !== 'authenticated') {
        queryClient.clear();
        usePendingStore.getState().clear();
        useToastStore.getState().clear();
        resetAssistant();
        useAiFailuresStore.getState().clear();
      }
      // Signed in (also after a reload): unsent messages kept in this tab belong to this user only.
      if (state.user && state.user.id !== prev.user?.id) {
        usePendingStore.getState().keepOnly(state.user.id);
      }
    });

    // Another tab logged out: forget our in-memory session too. RequireAuth then redirects.
    const unsubscribeBroadcast = onAuthMessage((message) => {
      if (message.type === 'logout') useAuthStore.getState().clear();
    });
    return () => {
      unsubscribe();
      unsubscribeBroadcast();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
