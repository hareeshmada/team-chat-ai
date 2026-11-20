import { APP_NAME } from '@teamchat/shared';
import { lazy, Suspense } from 'react';

// Temporary dev-only component preview at /dev/ui. In a production build import.meta.env.DEV
// is false, so Vite drops this import entirely. Step 1.3 moves it into the router.
const UiPreview = import.meta.env.DEV ? lazy(() => import('./dev/UiPreview')) : null;

export function App() {
  if (UiPreview && window.location.pathname === '/dev/ui') {
    return (
      <Suspense fallback={null}>
        <UiPreview />
      </Suspense>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
    </main>
  );
}
