import { NOT_RECORDED } from '../lib/not-recorded';

/**
 * The three acquisition channels the chart knows how to colour (003 FR1, FR3), and the part of a
 * bar no channel accounts for (004 FR3) — coloured as absence, never as a fourth channel.
 */
export type ChannelKey = 'existing' | 'organic' | 'paid' | 'not-recorded';

const KEYS: Readonly<Record<string, ChannelKey>> = {
  'Existing clients': 'existing',
  'New organic': 'organic',
  'New paid': 'paid',
  [NOT_RECORDED]: 'not-recorded',
};

/**
 * A served channel name → its colour key. The entity groups channels by whatever names the data
 * carries; colours are this widget's business, so an unknown name throws here rather than
 * leaving a bar silently uncoloured or a legend entry missing (003 §2.1).
 */
export const channelKey = (name: string): ChannelKey => {
  const key = KEYS[name];
  if (key === undefined) throw new Error(`The clients chart has no colour for channel "${name}"`);
  return key;
};

/** The channel's colour as a token reference, for SVG `fill`. */
export const channelColour = (name: string): string => `var(--color-channel-${channelKey(name)})`;
