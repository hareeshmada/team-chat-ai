import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppHome } from './features/app/AppHome';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { GuestOnly, RequireAuth } from './features/auth/routeGuards';

// Dev-only component preview. import.meta.env.DEV is a build-time constant, so in a production
// build this array is empty and the dynamic import (and UiPreview's code) is dropped.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/ui',
        lazy: async () => ({ Component: (await import('./dev/UiPreview')).default }),
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [{ index: true, element: <AppHome /> }],
  },
  { path: '/', element: <Navigate to="/app" replace /> },
  ...devRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
]);
