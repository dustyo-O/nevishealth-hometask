import { describe, expect, it } from 'vitest';
import { buildClientsUrl } from './clients-url';

describe('buildClientsUrl', () => {
  it('is the bare endpoint without switches', () => {
    expect(buildClientsUrl({})).toBe('/api/clients');
    expect(buildClientsUrl()).toBe('/api/clients');
  });

  it('forwards the dev switches as query parameters', () => {
    expect(buildClientsUrl({ delay: '3000', fail: '1' })).toBe('/api/clients?delay=3000&fail=1');
    expect(buildClientsUrl({ delay: '3000' })).toBe('/api/clients?delay=3000');
    expect(buildClientsUrl({ fail: '1' })).toBe('/api/clients?fail=1');
  });
});
