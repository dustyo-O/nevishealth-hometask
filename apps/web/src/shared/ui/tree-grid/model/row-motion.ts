import type { AutoAnimateOptions, AutoAnimationPlugin } from '@formkit/auto-animate';

/**
 * How long a row takes to slide, and therefore how long a departing one lingers in the DOM —
 * the ~250 ms D-8 measured, which is why a test waits for a closed row to go rather than
 * counting rows the moment it clicks.
 */
export const ROW_MOTION_MS = 250;

const TIMING: KeyframeEffectOptions = { duration: ROW_MOTION_MS, easing: 'ease-in-out' };

/**
 * What the library hands a plugin. It passes the row's *own* box third — its new one when the
 * row is being added, its old one when the row is leaving or moving — and, only for a row that
 * is staying put, its new box fourth. (The published types name these the other way round for
 * `remain`; the library's calls are `(el, 'add', newCoords)`, `(el, 'remove', oldCoords)` and
 * `(el, 'remain', oldCoords, newCoords)`, and the docs' own plugin example agrees with the code.)
 */
type RowBox = { top: number; height: number };

/**
 * D-16: the rows literally slide. `translateY` and nothing else — FR2 says a row slides in when
 * it appears and out when it disappears, and the library's own default is a scale-and-fade that
 * a reviewer reading the spec beside the app would notice.
 *
 * Everything moves the same way: a row arrives from one row-height above and settles, a row
 * leaves upwards into the row it belonged to, and the rows below travel from where they were to
 * where they now are. `translateY` is safe on a `<tr>` — a table row is a transformable element.
 */
const keyframesFor = (
  action: 'add' | 'remove' | 'remain',
  box: RowBox | undefined,
  nextBox: RowBox | undefined,
): Keyframe[] => {
  if (action === 'remain') {
    const delta = (box?.top ?? 0) - (nextBox?.top ?? 0);
    return [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }];
  }

  const height = box?.height ?? 0;
  const away: Keyframe = { transform: `translateY(-${height}px)`, opacity: 0 };
  const home: Keyframe = { transform: 'translateY(0)', opacity: 1 };
  return action === 'add' ? [away, home] : [home, away];
};

/**
 * D-15a: a row that is leaving is out of the table the moment it starts to go, whatever the
 * screen still shows. Without this the closed descendants sit in the accessibility tree for the
 * length of the animation carrying an `aria-level` and an `aria-posinset` that are no longer
 * true, and a screen reader's virtual cursor can land on a row that is logically gone.
 * `pointer-events: none` (which the library applies itself) and `tabindex="-1"` do neither.
 *
 * It gives up its ids on the way out for the same reason. Re-opening a row inside the ~250 ms
 * its old rows take to leave puts two elements with the same id in the document, and
 * `document.getElementById` — which the keyboard resolves the element to focus by (D-9/D-11) —
 * answers with the one that comes first, which may be the departing one. Measured in Chrome
 * 153: closing and re-opening a row quickly and then pressing Down left the outline nowhere,
 * focus still on the row before it while the grid's single `tabindex="0"` had moved on, because
 * `focus()` on an `inert` element does nothing at all.
 */
const retireLeavingRow = (el: Element) => {
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('inert', '');
  el.removeAttribute('id');
  for (const descendant of el.querySelectorAll('[id]')) descendant.removeAttribute('id');
};

export const slideRows: AutoAnimationPlugin = (el, action, box, nextBox) => {
  if (action === 'remove') retireLeavingRow(el);
  return new KeyframeEffect(el, keyframesFor(action, box, nextBox), TIMING);
};

/**
 * The library respects `prefers-reduced-motion` only for its own default options: given a
 * plugin it assumes the plugin has taken that on (`mediaQuery.matches && !isPlugin(config)`).
 * So the choice is made here, and under `reduce` the library is handed plain options instead —
 * which disables it outright: no animation is created at all and a closed row leaves the DOM
 * with the render that closed it (FR2-AC8), exactly the behaviour D-8 measured.
 *
 * Read once, when the grid mounts: `useAutoAnimate` keeps the first value it is given, and the
 * library reads the media query once when it starts. Changing the setting needs a reload, which
 * the README says out loud rather than working around.
 */
export const rowMotion = (): AutoAnimationPlugin | Partial<AutoAnimateOptions> =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? NO_MOTION : slideRows;

const NO_MOTION: Partial<AutoAnimateOptions> = {};
