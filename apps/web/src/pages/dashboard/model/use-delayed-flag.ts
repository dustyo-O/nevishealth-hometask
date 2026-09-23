import { useEffect, useState } from 'react';

/**
 * `true` once `active` has held for `ms` without a break; `false` the moment it stops, so the
 * next stretch starts again from zero. A stretch shorter than `ms` never turns it on at all.
 */
export const useDelayedFlag = (active: boolean, ms: number): boolean => {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, ms]);
  return active && elapsed;
};
