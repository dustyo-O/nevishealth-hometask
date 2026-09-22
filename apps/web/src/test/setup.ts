import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterEach, expect } from 'vitest';

expect.extend(toHaveNoViolations);

// jsdom implements no layout, so `Element.prototype.scrollIntoView` does not exist at all. The
// tree grid calls it on every keystroke (002 D-7); what it actually *does* is a browser
// question, answered by `e2e/table-keyboard-scroll.spec.ts` rather than here.
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
});
