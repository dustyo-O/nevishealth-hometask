import { describe, expect, it } from 'vitest';
import { REQUEST_TIMEOUT_MS, RETRY_DELAY_MS } from './config';
import { createQueryClient } from './query-client';

describe('createQueryClient', () => {
  it('applies the spec defaults to every query (tech doc D-6)', () => {
    expect(createQueryClient().getDefaultOptions().queries).toEqual({
      retry: 1,
      retryDelay: 500,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: 'always',
    });
  });

  it('lets a test override single defaults without losing the rest', () => {
    expect(createQueryClient({ retryDelay: 0 }).getDefaultOptions().queries).toMatchObject({
      retry: 1,
      retryDelay: 0,
      staleTime: Infinity,
      networkMode: 'always',
    });
  });

  it('exposes the spec numbers as constants', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(RETRY_DELAY_MS).toBe(500);
  });
});
