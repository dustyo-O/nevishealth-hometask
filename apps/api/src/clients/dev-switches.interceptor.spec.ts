import { InternalServerErrorException, type ExecutionContext } from '@nestjs/common';
import { of, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ApiConfig } from '../config.js';
import { DevSwitchesInterceptor, clampDelay } from './dev-switches.interceptor.js';

const MAX_DELAY_MS = 30_000;

const configWith = (enabled: boolean): ApiConfig => ({
  port: 3000,
  devSwitches: { enabled, maxDelayMs: MAX_DELAY_MS },
  corsOrigin: false,
});

/** The handler's result — the interceptor must hand exactly this back when it lets the request through. */
const RESULT: Observable<unknown> = of({ passed: 'through' });

/** A `CallHandler` whose `handle` is a plain mock property (a method signature trips `unbound-method`). */
type FakeHandler = { handle: Mock<() => Observable<unknown>> };

const handler = (): FakeHandler => ({ handle: vi.fn(() => RESULT) });

/**
 * A minimal `ExecutionContext`: the request's `query` is what the interceptor may read, and
 * `switchToHttp` is a spy so a test can prove the request was never even looked at.
 */
const contextFor = (query: unknown): { context: ExecutionContext; switchToHttp: Mock } => {
  const switchToHttp = vi.fn(() => ({ getRequest: () => ({ query }) }));
  return { context: { switchToHttp } as unknown as ExecutionContext, switchToHttp };
};

/** Tracks whether `intercept()` has settled yet — the only observable effect of the sleep. */
const settle = <T>(promise: Promise<T>) => {
  const state = { settled: false, error: undefined as unknown };
  promise.then(
    () => (state.settled = true),
    (error: unknown) => {
      state.settled = true;
      state.error = error;
    },
  );
  return state;
};

describe('clampDelay', () => {
  it.each([
    ['3000', 3000],
    ['0', 0],
    ['30000', 30_000],
    ['30001', 30_000],
    ['999999999', 30_000],
    ['-5', 0],
    ['abc', 0],
    ['', 0],
    [undefined, 0],
    [['1000', '2000'], 0],
    [{ nested: '1000' }, 0],
  ])('clamps %j to %i within [0, 30000]', (raw, expected) => {
    expect(clampDelay(raw, MAX_DELAY_MS)).toBe(expected);
  });
});

describe('DevSwitchesInterceptor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when the switches are disabled (production)', () => {
    const interceptor = new DevSwitchesInterceptor(configWith(false));

    it('passes the request through untouched and never reads the query', async () => {
      const { context, switchToHttp } = contextFor({ delay: '10000', fail: '1' });
      const next = handler();

      const result = await interceptor.intercept(context, next);

      expect(result).toBe(RESULT);
      expect(next.handle).toHaveBeenCalledOnce();
      expect(switchToHttp).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('when the switches are enabled (development)', () => {
    const interceptor = new DevSwitchesInterceptor(configWith(true));

    it('passes a request without switches straight through', async () => {
      const next = handler();

      const result = await interceptor.intercept(contextFor({}).context, next);

      expect(result).toBe(RESULT);
      expect(next.handle).toHaveBeenCalledOnce();
    });

    it('?fail=1 throws the documented 500 without calling the handler', async () => {
      const next = handler();

      const attempt = interceptor.intercept(contextFor({ fail: '1' }).context, next);

      await expect(attempt).rejects.toBeInstanceOf(InternalServerErrorException);
      await expect(attempt).rejects.toMatchObject({
        message: 'Failing on purpose (?fail=1)',
      });
      const error = (await attempt.catch((e: unknown) => e)) as InternalServerErrorException;
      expect(error.getStatus()).toBe(500);
      expect(error.getResponse()).toEqual({
        message: 'Failing on purpose (?fail=1)',
        error: 'Internal Server Error',
        statusCode: 500,
      });
      expect(next.handle).not.toHaveBeenCalled();
    });

    it.each(['0', 'true', 'yes', '11'])(
      '?fail=%s is not the switch and passes through',
      async (fail) => {
        const next = handler();

        const result = await interceptor.intercept(contextFor({ fail }).context, next);

        expect(result).toBe(RESULT);
        expect(next.handle).toHaveBeenCalledOnce();
      },
    );

    it('?delay=3000 holds the request for exactly the delay, then calls the handler', async () => {
      const next = handler();
      const state = settle(interceptor.intercept(contextFor({ delay: '3000' }).context, next));

      await vi.advanceTimersByTimeAsync(2999);
      expect(state.settled).toBe(false);
      expect(next.handle).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(state.settled).toBe(true);
      expect(state.error).toBeUndefined();
      expect(next.handle).toHaveBeenCalledOnce();
    });

    it('?delay=3000&fail=1 waits for the delay and then fails', async () => {
      const next = handler();
      const state = settle(
        interceptor.intercept(contextFor({ delay: '3000', fail: '1' }).context, next),
      );

      await vi.advanceTimersByTimeAsync(2999);
      expect(state.settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(state.settled).toBe(true);
      expect(state.error).toBeInstanceOf(InternalServerErrorException);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('caps the delay at maxDelayMs', async () => {
      const next = handler();
      const state = settle(interceptor.intercept(contextFor({ delay: '999999' }).context, next));

      await vi.advanceTimersByTimeAsync(MAX_DELAY_MS - 1);
      expect(state.settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(state.settled).toBe(true);
      expect(next.handle).toHaveBeenCalledOnce();
    });

    it.each([['abc'], ['-5'], [''], ['0'], [['1000', '2000']]])(
      'treats the delay %j as 0 and schedules no wait at all',
      async (delay) => {
        const next = handler();

        const attempt = interceptor.intercept(contextFor({ delay }).context, next);

        expect(vi.getTimerCount()).toBe(0);
        await expect(attempt).resolves.toBe(RESULT);
        expect(next.handle).toHaveBeenCalledOnce();
      },
    );
  });
});
