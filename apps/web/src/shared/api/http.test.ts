import { describe, expect, it, vi } from 'vitest';
import { ApiError, HttpError, NetworkError, TimeoutError, UnexpectedShapeError } from './errors';
import { getJson } from './http';

const URL_PATH = '/api/clients';

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const mockFetch = (impl: FetchImpl) => vi.spyOn(globalThis, 'fetch').mockImplementation(impl);

/** A server that accepts the request and never answers, but honours the abort signal like a real fetch. */
const hangingFetch: FetchImpl = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) {
      reject(signal.reason as Error);
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason as Error), { once: true });
  });

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (error: unknown) => error,
  );

describe('getJson', () => {
  it('resolves with the parsed body and asks for JSON', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(Response.json({ ok: true })));

    await expect(getJson(URL_PATH)).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(URL_PATH);
    expect(init?.headers).toEqual({ accept: 'application/json' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps a TypeError from fetch (unreachable service) to "Network error"', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const error = await rejectionOf(getJson(URL_PATH));

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ kind: 'network', detail: 'Network error' });
  });

  it('maps a non-2xx status to "Request failed with status N"', async () => {
    mockFetch(() => Promise.resolve(Response.json({ message: 'boom' }, { status: 500 })));

    const error = await rejectionOf(getJson(URL_PATH));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      kind: 'http',
      status: 500,
      detail: 'Request failed with status 500',
    });
  });

  it('aborts a request that exceeds the timeout with "Request timed out"', async () => {
    mockFetch(hangingFetch);

    const error = await rejectionOf(getJson(URL_PATH, { timeoutMs: 10 }));

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toMatchObject({ kind: 'timeout', detail: 'Request timed out' });
  });

  it('maps a body that is not JSON to "Unexpected data shape"', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      ),
    );

    const error = await rejectionOf(getJson(URL_PATH));

    expect(error).toBeInstanceOf(UnexpectedShapeError);
    expect(error).toMatchObject({ kind: 'shape', detail: 'Unexpected data shape' });
  });

  it('rethrows a foreign abort (the caller cancelling) untouched', async () => {
    mockFetch(hangingFetch);
    const controller = new AbortController();

    const pending = rejectionOf(
      getJson(URL_PATH, { signal: controller.signal, timeoutMs: 10_000 }),
    );
    controller.abort();
    const error = await pending;

    expect(error).toBe(controller.signal.reason);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'AbortError' });
  });

  it('honours a signal that is already aborted', async () => {
    const fetchMock = mockFetch(hangingFetch);
    const controller = new AbortController();
    controller.abort();

    const error = await rejectionOf(getJson(URL_PATH, { signal: controller.signal }));

    expect(error).toBe(controller.signal.reason);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears its timer once the request has settled', async () => {
    vi.useFakeTimers();
    try {
      mockFetch(() => Promise.resolve(Response.json({ ok: true })));

      await getJson(URL_PATH, { timeoutMs: 10_000 });

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
