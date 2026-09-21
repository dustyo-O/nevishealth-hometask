import type { DevSwitches } from '../model/types';

const SWITCH_KEYS = ['delay', 'fail'] as const satisfies readonly (keyof DevSwitches)[];

/** Only the keys that are actually present, so `{}` stays `{}` and the query key stays clean. */
const pick = (params: URLSearchParams, keys: typeof SWITCH_KEYS): DevSwitches => {
  const switches: DevSwitches = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null) switches[key] = value;
  }
  return switches;
};

/**
 * The demonstration switches from the page's own address (spec 001 FR6), forwarded verbatim to
 * the data service. The gate is the branch itself: Vite replaces `import.meta.env.DEV` statically,
 * so the production bundle keeps only `{}` and the minifier drops `pick` (tech doc §2.4, R5).
 */
export const readDevSwitches = (search: string): DevSwitches =>
  import.meta.env.DEV ? pick(new URLSearchParams(search), SWITCH_KEYS) : {};
