import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { onAuthMessage } from './features/auth/broadcast';
import { restoreSession } from './features/auth/session';
import { router } from './router';
import { useAuthStore } from './stores/auth';

export function App() {
  useEffect(() => {
    // Memoised: StrictMode runs this effect twice in dev, but only one /auth/refresh is sent.
    void restoreSession();

    // Another tab logged out: forget our in-memory session too. RequireAuth then redirects.
    return onAuthMessage((message) => {
      if (message.type === 'logout') useAuthStore.getState().clear();
    });
  }, []);

  return <RouterProvider router={router} />;
}
