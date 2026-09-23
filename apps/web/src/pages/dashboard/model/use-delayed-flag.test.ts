import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedFlag } from './use-delayed-flag';

const MS = 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const renderFlag = (active: boolean) =>
  renderHook(({ on }) => useDelayedFlag(on, MS), { initialProps: { on: active } });

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('useDelayedFlag', () => {
  it('stays off until the stretch has lasted the whole delay, then turns on', () => {
    const { result } = renderFlag(true);

    expect(result.current).toBe(false);
    advance(MS - 1);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it('never turns on for a stretch shorter than the delay', () => {
    const { result, rerender } = renderFlag(true);

    advance(MS - 1);
    rerender({ on: false });
    advance(MS);

    expect(result.current).toBe(false);
  });

  it('turns off the moment the stretch ends, and the next one waits from zero again', () => {
    const { result, rerender } = renderFlag(true);
    advance(MS);
    expect(result.current).toBe(true);

    rerender({ on: false });
    expect(result.current).toBe(false);

    rerender({ on: true });
    expect(result.current).toBe(false);
    advance(MS - 1);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it('stays off while inactive, however long', () => {
    const { result } = renderFlag(false);

    advance(MS * 10);

    expect(result.current).toBe(false);
  });
});
