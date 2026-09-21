import { REQUEST_TIMEOUT_MS } from './config';
import { ApiError, HttpError, NetworkError, TimeoutError, UnexpectedShapeError } from './errors';

const TIMEOUT_REASON_NAME = 'TimeoutError';

export type TimedSignal = {
  signal: AbortSignal;
  /** Stops the timer and detaches from the upstream signal; call once the request has settled. */
  clear: () => void;
};

/**
 * A signal that aborts when `upstream` aborts (with its reason) or after `ms` with a
 * `DOMException('Request timed out', 'TimeoutError')`. Own composite instead of `AbortSignal.any`
 * (Safari 17.4+, outside Vite's default target) and `AbortSignal.timeout` (no upstream) — and it
 * runs under fake timers.
 */
export const withTimeout = (upstream: AbortSignal | undefined, ms: number): TimedSignal => {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(upstream?.reason);

  if (upstream?.aborted) forwardAbort();
  else upstream?.addEventListener('abort', forwardAbort, { once: true });

  const timer = setTimeout(
    () => controller.abort(new DOMException('Request timed out', TIMEOUT_REASON_NAME)),
    ms,
  );

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', forwardAbort);
    },
  };
};

const isTimeoutAbort = (signal: AbortSignal): boolean =>
  signal.aborted && (signal.reason as { name?: unknown } | undefined)?.name === TIMEOUT_REASON_NAME;

export type GetJsonOptions = {
  /** The caller's signal (TanStack Query cancelling on unmount); its abort is rethrown as is. */
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * `GET url` as JSON, every failure mapped onto the `ApiError` taxonomy (tech doc §2.4):
 * `fetch` TypeError → `NetworkError`; non-2xx → `HttpError`; the timeout → `TimeoutError`;
 * a body that is not JSON → `UnexpectedShapeError`. A foreign abort is not an API failure and
 * propagates untouched. The body is `unknown` on purpose — callers validate the shape.
 */
export const getJson = async (
  url: string,
  { signal, timeoutMs = REQUEST_TIMEOUT_MS }: GetJsonOptions = {},
): Promise<unknown> => {
  const timed = withTimeout(signal, timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: timed.signal,
    });
    if (!response.ok) throw new HttpError(response.status);
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isTimeoutAbort(timed.signal)) throw new TimeoutError({ cause: error });
    if (timed.signal.aborted) throw error;
    if (error instanceof TypeError) throw new NetworkError({ cause: error });
    if (error instanceof SyntaxError) throw new UnexpectedShapeError({ cause: error });
    throw error;
  } finally {
    timed.clear();
  }
};
