// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR3 "Loading state" and FR6-AC1: the page draws the design's frame at once, tells assistive
// technology it is loading, and lands the figures in the very same places when they arrive.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { installClientsDouble, queriesOf, waitSinceFirstRequest } from './support/clients-double';
import {
  cardBoxes,
  clientsPage,
  expectTableLoaded,
  isSameDocument,
  markDocument,
  sameBoxes,
  TEXT,
  VIEWPORT,
} from './support/clients-page';

const DELAY_MS = 3000;
/** The page's own `LOADING_ANNOUNCE_DELAY_MS`: the wait before the live region says anything. */
const ANNOUNCE_DELAY_MS = 1000;

/**
 * The grey blocks, found by the `Skeleton` component's own class (Vite scopes it as
 * `_skeleton_<hash>_<line>`). Not by `[aria-hidden="true"]` any more: since spec 002 a loaded
 * row reserves its chevron's place with an `aria-hidden` span of its own, so the attribute no
 * longer tells a placeholder from a row that has arrived.
 */
const placeholderBlocks = (card: Locator) => card.locator('[class*="_skeleton_"]');

type TimedWindow = Window & {
  __spokeAfterMs?: number | null;
  __figuresLandedMs?: number | null;
};

/**
 * Times the announcement *and* the figures landing from inside the page, off one clock, starting
 * before the app mounts. FR3 is about *when* the region speaks — a screen reader is still reading
 * the page it just opened for the first moment — so the e2e measures the wait instead of sampling
 * the region and hoping.
 *
 * Both events are marked the same way because the promise FR3 makes is about their *order*: the
 * page waits `LOADING_ANNOUNCE_DELAY_MS` from its own mount, not from `goto`, so under the full
 * suite's parallel load mount lands seconds in and any budget measured from page-open drifts with
 * it — while "spoke after the wait, and before the figures" does not.
 * Must be installed before `goto`.
 */
const recordTimings = (page: Page) =>
  page.addInitScript(() => {
    const marks = window as TimedWindow;
    const start = performance.now();
    marks.__spokeAfterMs = null;
    marks.__figuresLandedMs = null;
    new MutationObserver(() => {
      const status = document.querySelector('[role="status"]');
      if (marks.__spokeAfterMs === null && status !== null && status.textContent !== '') {
        marks.__spokeAfterMs = performance.now() - start;
      }
      // The table renders nothing at all until the figures are here, so its arrival in the DOM
      // *is* the figures landing — and, unlike `aria-busy="false"`, it can never mean the error
      // panel instead.
      const table = document.querySelector('[role="treegrid"]');
      if (marks.__figuresLandedMs === null && table !== null) {
        marks.__figuresLandedMs = performance.now() - start;
      }
    }).observe(document, { childList: true, characterData: true, subtree: true });
  });

/** How long after the page opened the region first carried text; `null` if it never did. */
const spokeAfterMs = (page: Page) =>
  page.evaluate(() => (window as TimedWindow).__spokeAfterMs ?? null);

/** How long after the page opened the table first stood in the DOM; `null` if it never did. */
const figuresLandedMs = (page: Page) =>
  page.evaluate(() => (window as TimedWindow).__figuresLandedMs ?? null);

for (const [name, viewport] of Object.entries(VIEWPORT)) {
  test.describe(`at ${viewport.width} px (${name})`, () => {
    test.use({ viewport });

    test(
      'FR3-AC1/AC2, FR6-AC1: the frame and the placeholders within 1 s, "Loading clients…" announced only once the wait has passed, then the figures land in place without a reload',
      { tag: '@regression' },
      async ({ page }) => {
        const double = await installClientsDouble(page);
        const ui = clientsPage(page);
        await recordTimings(page);

        // The page forwards `?delay=3000` to the service (FR6); the double, like the service, waits.
        await page.goto(`/?delay=${DELAY_MS}`);
        await markDocument(page);

        // Within 1 second, everything the eye needs: heading, two placeholder cards, the busy
        // flag. What is *spoken* is not here yet — it has its own wait, timed below.
        await expect(ui.heading).toBeVisible({ timeout: 1000 });
        await expect(ui.grid).toHaveAttribute('aria-busy', 'true', { timeout: 1000 });
        await expect(ui.chartCard).toBeVisible();
        await expect(ui.tableCard).toBeVisible();
        expect(await placeholderBlocks(ui.chartCard).count()).toBeGreaterThan(0);
        expect(await placeholderBlocks(ui.tableCard).count()).toBeGreaterThan(0);
        await expect(ui.chartCard).toHaveText('');
        await expect(ui.tableCard).toHaveText('');
        await expect(ui.alert).toHaveCount(0);
        const whileLoading = await cardBoxes(ui);

        // Then the announcement — after about a second, so the screen reader's own page-opening
        // speech is over, and well before the figures land (FR3-AC2, amended 2026-09-22).
        await expect(ui.status).toHaveText(TEXT.loading, { timeout: DELAY_MS });
        const spokeAfter = await spokeAfterMs(page);
        expect(spokeAfter).not.toBeNull();
        expect(spokeAfter).toBeGreaterThanOrEqual(ANNOUNCE_DELAY_MS);

        // The placeholders stay for at least the service's delay (FR6-AC1).
        await waitSinceFirstRequest(double, DELAY_MS - 500);
        await expect(ui.status).toHaveText(TEXT.loading);
        await expect(ui.grid).toHaveAttribute('aria-busy', 'true');

        // Then the figures arrive: same cards, same places, no announcement, no reload.
        await expect(ui.chartCard).toHaveText(TEXT.period, { timeout: DELAY_MS + 3000 });
        await expectTableLoaded(ui);
        await expect(ui.grid).toHaveAttribute('aria-busy', 'false');
        await expect(ui.status).toHaveText('');
        await expect(placeholderBlocks(ui.chartCard)).toHaveCount(0);
        await expect(placeholderBlocks(ui.tableCard)).toHaveCount(0);
        expect(sameBoxes(whileLoading, await cardBoxes(ui))).toBe(true);
        expect(await isSameDocument(page)).toBe(true);

        // The other half of FR3-AC2: the announcement fell *before* the figures did. Both marks
        // are the page's own, so the order holds however late the page mounted.
        const figuresLanded = await figuresLandedMs(page);
        expect(figuresLanded).not.toBeNull();
        expect(spokeAfter).toBeLessThan(figuresLanded!);

        // Every request the page made carried the switch.
        expect(queriesOf(double).every((query) => query === `?delay=${DELAY_MS}`)).toBe(true);
      },
    );
  });
}

test(
  'FR3-AC3: the figures arriving at once still pass through the same frame — no flash of an error, no empty page, and nothing announced',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page);
    const ui = clientsPage(page);
    await recordTimings(page);

    await page.goto('/');

    await expect(ui.heading).toBeVisible();
    await expect(ui.chartCard).toHaveText(TEXT.period);
    await expectTableLoaded(ui);
    await expect(ui.grid).toHaveAttribute('aria-busy', 'false');
    await expect(ui.status).toHaveText('');
    await expect(ui.alert).toHaveCount(0);

    // The figures were already there, so the announcement was never due: past the moment it
    // would have fallen, the region has still never carried a word (FR3-AC3).
    await page.waitForTimeout(ANNOUNCE_DELAY_MS + 500);
    await expect(ui.status).toHaveText('');
    expect(await spokeAfterMs(page)).toBeNull();
  },
);
