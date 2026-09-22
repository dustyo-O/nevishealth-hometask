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
  isSameDocument,
  markDocument,
  sameBoxes,
  TEXT,
  VIEWPORT,
} from './support/clients-page';

const DELAY_MS = 3000;
/** The page's own `LOADING_ANNOUNCE_DELAY_MS`: the wait before the live region says anything. */
const ANNOUNCE_DELAY_MS = 1000;

const placeholderBlocks = (card: Locator) => card.locator('[aria-hidden="true"]');

type AnnouncingWindow = Window & { __spokeAfterMs?: number | null };

/**
 * Times the announcement from inside the page, starting before the app mounts. FR3 is about
 * *when* the region speaks — a screen reader is still reading the page it just opened for the
 * first moment — so the e2e measures the wait instead of sampling the region and hoping.
 * Must be installed before `goto`.
 */
const recordAnnouncement = (page: Page) =>
  page.addInitScript(() => {
    const marks = window as AnnouncingWindow;
    const start = performance.now();
    marks.__spokeAfterMs = null;
    new MutationObserver(() => {
      const status = document.querySelector('[role="status"]');
      if (marks.__spokeAfterMs === null && status !== null && status.textContent !== '') {
        marks.__spokeAfterMs = performance.now() - start;
      }
    }).observe(document, { childList: true, characterData: true, subtree: true });
  });

/** How long after the page opened the region first carried text; `null` if it never did. */
const spokeAfterMs = (page: Page) =>
  page.evaluate(() => (window as AnnouncingWindow).__spokeAfterMs ?? null);

for (const [name, viewport] of Object.entries(VIEWPORT)) {
  test.describe(`at ${viewport.width} px (${name})`, () => {
    test.use({ viewport });

    test(
      'FR3-AC1/AC2, FR6-AC1: the frame and the placeholders within 1 s, "Loading clients…" announced only once the wait has passed, then the figures land in place without a reload',
      { tag: '@regression' },
      async ({ page }) => {
        const double = await installClientsDouble(page);
        const ui = clientsPage(page);
        await recordAnnouncement(page);

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
        expect(spokeAfter).toBeLessThan(DELAY_MS);

        // The placeholders stay for at least the service's delay (FR6-AC1).
        await waitSinceFirstRequest(double, DELAY_MS - 500);
        await expect(ui.status).toHaveText(TEXT.loading);
        await expect(ui.grid).toHaveAttribute('aria-busy', 'true');

        // Then the figures arrive: same cards, same places, no announcement, no reload.
        await expect(ui.chartCard).toHaveText(TEXT.period, { timeout: DELAY_MS + 3000 });
        await expect(ui.tableCard).toHaveText(TEXT.branches);
        await expect(ui.grid).toHaveAttribute('aria-busy', 'false');
        await expect(ui.status).toHaveText('');
        await expect(placeholderBlocks(ui.chartCard)).toHaveCount(0);
        await expect(placeholderBlocks(ui.tableCard)).toHaveCount(0);
        expect(sameBoxes(whileLoading, await cardBoxes(ui))).toBe(true);
        expect(await isSameDocument(page)).toBe(true);

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
    await recordAnnouncement(page);

    await page.goto('/');

    await expect(ui.heading).toBeVisible();
    await expect(ui.chartCard).toHaveText(TEXT.period);
    await expect(ui.tableCard).toHaveText(TEXT.branches);
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
