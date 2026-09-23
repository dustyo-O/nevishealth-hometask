import autoAnimate from '@formkit/auto-animate';
import { useEffect, type RefObject } from 'react';
import { rowMotion } from './row-motion';

/**
 * FR2-AC8, D-16: the children of `ref` slide as they come and go, and the ones that stay travel
 * with them. The motion is chosen once, at mount: under `prefers-reduced-motion` the library is
 * disabled outright (see `rowMotion`).
 *
 * An effect with a cleanup rather than the library's own `useAutoAnimate`, whose ref callback
 * cannot undo its registration: under StrictMode's double mount the first registration would
 * survive, and two observers on one element cancel every arriving row's slide.
 */
export const useRowMotion = (ref: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const motion = autoAnimate(element, rowMotion());
    return () => motion.destroy?.();
  }, [ref]);
};
