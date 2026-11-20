import { Navigate, Outlet, useLocation, type Location } from 'react-router';
import { useAuthStore } from '../../stores/auth';
import { LoadingScreen } from './LoadingScreen';

/** Protected routes: wait for the restore, then render the page or send the user to /login. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'anonymous') {
    // Remember where they were going, so login can send them back there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** /login and /register: a signed-in user is sent on to the app (or where they came from). */
export function GuestOnly() {
  const status = useAuthStore((s) => s.status);
  const from = (useLocation().state as { from?: Location } | null)?.from;

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') {
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/app'} replace />;
  }
  return <Outlet />;
}
