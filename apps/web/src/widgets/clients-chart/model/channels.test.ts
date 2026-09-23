import { describe, expect, it } from 'vitest';
import { NOT_RECORDED } from '../lib/not-recorded';
import { channelColour, channelKey } from './channels';

describe('channelKey', () => {
  it('maps the three served channel names to their colour keys', () => {
    expect(['Existing clients', 'New organic', 'New paid'].map(channelKey)).toEqual([
      'existing',
      'organic',
      'paid',
    ]);
  });

  it('maps Not recorded to its own neutral key, not to one of the three channels (004 FR3)', () => {
    expect(channelKey(NOT_RECORDED)).toBe('not-recorded');
  });

  it('throws on a name it has no colour for, rather than silently dropping a channel', () => {
    expect(() => channelKey('Referral')).toThrow(/Referral/);
    expect(() => channelKey('Not Recorded')).toThrow(/Not Recorded/);
    expect(() => channelKey('Unattributed')).toThrow(/Unattributed/);
  });
});

describe('channelColour', () => {
  it('reads the channel colour from its token', () => {
    expect(channelColour('New organic')).toBe('var(--color-channel-organic)');
    expect(channelColour(NOT_RECORDED)).toBe('var(--color-channel-not-recorded)');
  });
});
