import { describe, expect, it } from 'vitest';
import { channelColour, channelKey } from './channels';

describe('channelKey', () => {
  it('maps the three served channel names to their colour keys', () => {
    expect(['Existing clients', 'New organic', 'New paid'].map(channelKey)).toEqual([
      'existing',
      'organic',
      'paid',
    ]);
  });

  it('throws on a name it has no colour for, rather than silently dropping a channel', () => {
    expect(() => channelKey('Referral')).toThrow(/Referral/);
    expect(() => channelKey('Unattributed')).toThrow(/Unattributed/);
  });

  it('has no fourth part: "Not recorded" is not a channel it knows (004 slice 3)', () => {
    expect(() => channelKey('Not recorded')).toThrow(/Not recorded/);
  });
});

describe('channelColour', () => {
  it('reads the channel colour from its token', () => {
    expect(channelColour('New organic')).toBe('var(--color-channel-organic)');
  });
});
