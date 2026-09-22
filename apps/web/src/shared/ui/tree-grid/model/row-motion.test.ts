import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROW_MOTION_MS, rowMotion, slideRows } from './row-motion';

/**
 * jsdom implements no Web Animations API, so `KeyframeEffect` does not exist at all. The stub
 * records what the plugin asked the browser for — which keyframes, on which element, for how
 * long — and that is the whole of the plugin's contract. Whether Chrome then moves the rows is
 * a browser question, answered by `e2e/table-animation.spec.ts` and by the measured walk in the
 * slice's ledger, not here.
 */
type RecordedEffect = {
  target: Element;
  keyframes: Keyframe[];
  timing: KeyframeEffectOptions | undefined;
};

class RecordingKeyframeEffect {
  target: Element;
  keyframes: Keyframe[];
  timing: KeyframeEffectOptions | undefined;

  constructor(target: Element, keyframes: Keyframe[], timing?: KeyframeEffectOptions) {
    this.target = target;
    this.keyframes = keyframes;
    this.timing = timing;
  }
}

const effectOf = (value: unknown): RecordedEffect => {
  if (!(value instanceof RecordingKeyframeEffect)) throw new Error('not a KeyframeEffect');
  return value;
};

/** One row, 56 px tall (`--table-row-h`), as the library measures it. */
const box = (top: number) => ({ top, left: 0, width: 264, height: 56 });

const row = () => document.createElement('tr');

beforeEach(() => {
  vi.stubGlobal('KeyframeEffect', RecordingKeyframeEffect);
});

describe('slideRows (D-16)', () => {
  it('slides an arriving row down into its place, from one row height above', () => {
    const el = row();

    const { target, keyframes, timing } = effectOf(slideRows(el, 'add', box(112)));

    expect(target).toBe(el);
    expect(keyframes).toEqual([
      { transform: 'translateY(-56px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 },
    ]);
    expect(timing).toEqual({ duration: ROW_MOTION_MS, easing: 'ease-in-out' });
  });

  it('slides a departing row up and out, the reverse of the way it came', () => {
    const { keyframes } = effectOf(slideRows(row(), 'remove', box(112)));

    expect(keyframes).toEqual([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-56px)', opacity: 0 },
    ]);
  });

  it('moves a row that stays from where it was to where it now is, without fading it', () => {
    const { keyframes } = effectOf(slideRows(row(), 'remain', box(280), box(168)));

    // It was 112 px further down, so it starts there and travels to its new place.
    expect(keyframes).toEqual([{ transform: 'translateY(112px)' }, { transform: 'translateY(0)' }]);
  });

  it('takes a departing row out of the accessibility tree as it starts to leave (D-15a)', () => {
    const el = row();

    slideRows(el, 'remove', box(112));

    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveAttribute('inert');
  });

  it('leaves an arriving row in the accessibility tree — it is here to stay', () => {
    const el = row();

    slideRows(el, 'add', box(112));

    expect(el).not.toHaveAttribute('aria-hidden');
    expect(el).not.toHaveAttribute('inert');
  });
});

describe('rowMotion', () => {
  it('gives the library the sliding plugin when nothing says otherwise', () => {
    expect(rowMotion()).toBe(slideRows);
  });

  it('gives it plain options under prefers-reduced-motion, which disables it (FR2-AC8)', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);

    const motion = rowMotion();

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    // Not a plugin: the library respects the setting only for its own options, and what it does
    // with them is to switch itself off entirely — no animation, no lingering row.
    expect(typeof motion).not.toBe('function');
  });
});
