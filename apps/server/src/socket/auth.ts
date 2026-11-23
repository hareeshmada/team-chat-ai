import type { ExtendedError } from 'socket.io';
import { AppError } from '../errors/AppError.js';
import { listWorkspaceIds } from '../services/access.service.js';
import { verifyAccessToken } from '../services/token.service.js';
import type { IoSocket } from './types.js';

/** connect_error on the client: err.message + err.data.code (same codes as the HTTP 401s). */
function authError(code: string, message: string): ExtendedError {
  const err: ExtendedError = new Error(message);
  err.data = { code };
  return err;
}

/**
 * Handshake middleware: runs once per connection, before 'connection'.
 * The client sends the access token in `auth: { token }` (not the URL, so it never lands in
 * proxy/access logs). The token is checked here only; an open connection outlives its expiry,
 * and the client reconnects with a fresh token.
 */
export async function socketAuth(socket: IoSocket, next: (err?: ExtendedError) => void) {
  const token: unknown = socket.handshake.auth?.token;
  if (typeof token !== 'string' || token === '') {
    next(authError('UNAUTHORIZED', 'Missing access token'));
    return;
  }

  try {
    const { userId } = verifyAccessToken(token);
    socket.data.userId = userId;
    // Loaded here (async) so the 'connection' handler can stay synchronous.
    socket.data.workspaceIds = await listWorkspaceIds(userId);
    next();
  } catch (err) {
    if (err instanceof AppError) next(authError(err.code, err.message));
    else next(authError('INTERNAL_ERROR', 'Could not authenticate'));
  }
}
