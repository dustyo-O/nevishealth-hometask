// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR3 "Loading state" and FR6-AC1: the page draws the design's frame at once, tells assistive
// technology it is loading, and lands the figures in the very same places when they arrive.
import { expect, test, type Locator } from '@playwright/test';
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

const placeholderBlocks = (card: Locator) => card.locator('[aria-hidden="true"]');

for (const [name, viewport] of Object.entries(VIEWPORT)) {
  test.describe(`at ${viewport.width} px (${name})`, () => {
    test.use({ viewport });

    test(
      'FR3-AC1/AC2, FR6-AC1: the frame and the placeholders within 1 s, "Loading clients…" announced, then the figures land in place without a reload',
      { tag: '@regression' },
      async ({ page }) => {
        const double = await installClientsDouble(page);
        const ui = clientsPage(page);

        // The page forwards `?delay=3000` to the service (FR6); the double, like the service, waits.
        await page.goto(`/?delay=${DELAY_MS}`);
        await markDocument(page);

        // Within 1 second: heading, two placeholder cards, the announcement.
        await expect(ui.heading).toBeVisible({ timeout: 1000 });
        await expect(ui.status).toHaveText(TEXT.loading, { timeout: 1000 });
        await expect(ui.grid).toHaveAttribute('aria-busy', 'true');
        await expect(ui.chartCard).toBeVisible();
        await expect(ui.tableCard).toBeVisible();
        expect(await placeholderBlocks(ui.chartCard).count()).toBeGreaterThan(0);
        expect(await placeholderBlocks(ui.tableCard).count()).toBeGreaterThan(0);
        await expect(ui.chartCard).toHaveText('');
        await expect(ui.tableCard).toHaveText('');
        await expect(ui.alert).toHaveCount(0);
        const whileLoading = await cardBoxes(ui);

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
  'FR3: the figures arriving at once still pass through the same frame — no flash of an error, no empty page',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/');

    await expect(ui.heading).toBeVisible();
    await expect(ui.chartCard).toHaveText(TEXT.period);
    await expect(ui.tableCard).toHaveText(TEXT.branches);
    await expect(ui.grid).toHaveAttribute('aria-busy', 'false');
    await expect(ui.status).toHaveText('');
    await expect(ui.alert).toHaveCount(0);
  },
);
