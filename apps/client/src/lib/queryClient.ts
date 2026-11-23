import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/**
 * One QueryClient for the app (module singleton), so non-React code (socket handlers, the send
 * queue) can write into the same cache the components read from.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx won't fix itself on retry (403 not a member, 404 gone); network errors might.
      retry: (failureCount, err) =>
        !(err instanceof ApiError && err.status >= 400 && err.status < 500) && failureCount < 2,
    },
  },
});
