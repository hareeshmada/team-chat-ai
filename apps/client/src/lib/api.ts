import { refreshResponseSchema } from '@teamchat/shared';
import { useAuthStore } from '../stores/auth';

const BASE_URL = import.meta.env.VITE_API_URL; // "/api": same origin through the Vite proxy

export interface ApiErrorDetail {
  location: 'params' | 'query' | 'body';
  path: string;
  message: string;
}

/** Any non-2xx response (or a network failure, status 0) as one typed error. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** VALIDATION_ERROR: ApiErrorDetail[]; AI_LIMIT_REACHED: the usage. Narrow before use. */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Anything with parse(): the shared Zod schemas, without the client depending on zod. */
interface Parser<T> {
  parse: (data: unknown) => T;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the access token and refresh + retry once on 401. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function send(path: string, options: ApiOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include', // send the httpOnly refresh cookie (only matters for /api/auth/*)
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection.");
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const error = (body as { error?: { code?: string; message?: string; details?: unknown } })?.error;
  return new ApiError(
    res.status,
    error?.code ?? 'UNKNOWN_ERROR',
    error?.message ?? 'Something went wrong. Please try again.',
    error?.details,
  );
}

// ---------------------------------------------------------------------------------------------
// Single-flight refresh: one module-level promise. Every caller that needs a new access token
// while a refresh is already running (several 401s at once, the app-load restore, StrictMode's
// double effect) awaits the same request, so the refresh token is rotated only once.
// ---------------------------------------------------------------------------------------------
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= (async () => {
    try {
      const res = await send('/auth/refresh', { method: 'POST' }, null);
      if (!res.ok) throw await toApiError(res);
      const { accessToken } = refreshResponseSchema.parse(await res.json());
      useAuthStore.getState().setAccessToken(accessToken);
      return accessToken;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Sends the request with the access token. On a 401 it refreshes once (shared with any refresh
 * already running) and resends. If the refresh fails, the session is over: the store is cleared
 * and the protected route redirects to /login. Returns the raw Response (api() parses JSON;
 * streamText() reads the body as a stream).
 */
export async function authedFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const res = await send(path, options, token);
  if (res.status !== 401) return res;

  let newToken: string;
  try {
    // If another request already refreshed while this one was in flight, the store holds a
    // newer token than the one we sent: just retry with it instead of refreshing again.
    const current = useAuthStore.getState().accessToken;
    newToken = current && current !== token ? current : await refreshAccessToken();
  } catch (err) {
    useAuthStore.getState().clear();
    throw err;
  }
  return send(path, options, newToken);
}

/** Turns a non-2xx response into an ApiError (reads the `{ error }` JSON body). */
export { toApiError };

/** fetch wrapper: JSON in/out, Bearer token from the auth store (see authedFetch), typed errors. */
export async function api<T = void>(
  path: string,
  options: ApiOptions = {},
  schema?: Parser<T>,
): Promise<T> {
  const res =
    (options.auth ?? true) ? await authedFetch(path, options) : await send(path, options, null);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204 || !schema) return undefined as T;
  return schema.parse(await res.json());
}
