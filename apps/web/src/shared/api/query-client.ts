import { QueryClient, type DefaultOptions } from '@tanstack/react-query';
import { RETRY_DELAY_MS } from './config';

export type QueryDefaults = NonNullable<DefaultOptions['queries']>;

/**
 * The spec's fetch policy, app-wide (tech doc D-6): one automatic second attempt half a second
 * later; never refetch on its own (only Retry or a reload); `networkMode: 'always'` so an offline
 * browser gets the "Network error" panel instead of a paused query and a skeleton forever.
 */
export const QUERY_DEFAULTS: QueryDefaults = {
  retry: 1,
  retryDelay: RETRY_DELAY_MS,
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  networkMode: 'always',
};

/** The app's `QueryClient`; tests pass `{ retryDelay: 0 }` to keep the same policy without the wait. */
export const createQueryClient = (overrides: QueryDefaults = {}): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { ...QUERY_DEFAULTS, ...overrides } } });
