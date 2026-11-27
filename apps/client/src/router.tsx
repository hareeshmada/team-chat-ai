import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { InvitePage } from './features/auth/InvitePage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { GuestOnly, RequireAuth } from './features/auth/routeGuards';
import {
  AppIndex,
  ChannelRoute,
  DefaultChannelRedirect,
  WorkspaceRoute,
} from './features/chat/routes';

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
  // The invite email's link: sign-up when signed out, join when signed in (no guard).
  { path: '/invite/:token', element: <InvitePage /> },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [
      // No workspace → onboarding; otherwise the last opened workspace.
      { index: true, element: <AppIndex /> },
      {
        path: ':workspaceId',
        element: <WorkspaceRoute />,
        children: [
          { index: true, element: <DefaultChannelRedirect /> },
          { path: ':channelId', element: <ChannelRoute /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/app" replace /> },
  ...devRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
]);
