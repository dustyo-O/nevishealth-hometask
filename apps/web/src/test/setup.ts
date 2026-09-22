import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterEach, expect } from 'vitest';

expect.extend(toHaveNoViolations);

// jsdom implements no layout, so `Element.prototype.scrollIntoView` does not exist at all. The
// tree grid calls it on every keystroke (002 D-7); what it actually *does* is a browser
// question, answered by `e2e/table-keyboard-scroll.spec.ts` rather than here.
Element.prototype.scrollIntoView = () => {};

// jsdom implements no media queries either, so `window.matchMedia` does not exist at all. The
// tree grid asks it once, when it mounts, whether the viewer wants less motion (002 D-16). The
// answer here is "no"; a test that needs "yes" says so for itself. What the browser then does
// with the answer is a browser question, not this environment's.
window.matchMedia = (media: string): MediaQueryList => ({
  media,
  matches: false,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

afterEach(() => {
  cleanup();
});
