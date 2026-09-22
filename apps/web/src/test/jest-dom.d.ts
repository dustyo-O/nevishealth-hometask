// Matcher types for the Vitest `expect` (setup.ts extends it at runtime).
// Verified on Vitest 5.0.1: `@testing-library/jest-dom/vitest` still merges its own matchers
// (testing-library/jest-dom#738 did not bite), so only jest-axe's matcher — whose types target Jest —
// needs re-attaching. `interface` is required: module augmentation merges declarations, a `type` cannot.
import 'vitest'; // makes this a module, so the block below augments vitest instead of replacing it

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must mirror Vitest's own type parameters to merge
  interface Matchers<R, T> {
    toHaveNoViolations(): R;
  }
}
