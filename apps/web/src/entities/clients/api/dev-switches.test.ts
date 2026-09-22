import { afterEach, describe, expect, it, vi } from 'vitest';
import { readDevSwitches } from './dev-switches';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readDevSwitches', () => {
  it('picks delay and fail from the page address in development (FR6)', () => {
    vi.stubEnv('DEV', true);

    expect(readDevSwitches('?delay=3000&fail=1')).toStrictEqual({ delay: '3000', fail: '1' });
    expect(readDevSwitches('?delay=3000')).toStrictEqual({ delay: '3000' });
    expect(readDevSwitches('?fail=1')).toStrictEqual({ fail: '1' });
  });

  it('ignores every other parameter and an empty address', () => {
    vi.stubEnv('DEV', true);

    expect(readDevSwitches('?fail=1&other=x')).toStrictEqual({ fail: '1' });
    expect(readDevSwitches('?other=x')).toStrictEqual({});
    expect(readDevSwitches('')).toStrictEqual({});
  });

  it('returns no switches in the production build (FR6-AC4)', () => {
    vi.stubEnv('DEV', false);

    expect(readDevSwitches('?delay=10000&fail=1')).toStrictEqual({});
  });
});
