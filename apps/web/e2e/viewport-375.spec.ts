// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR7 "Nothing breaks at 375 px": in all three states, no horizontal scrollbar, no content cut
// off, the Retry button reachable.
import { expect, test } from '@playwright/test';
import { installClientsDouble } from './support/clients-double';
import { clientsPage, rightEdgeOf, scrollWidthOf, TEXT, VIEWPORT } from './support/clients-page';

test.use({ viewport: VIEWPORT.phone });

const WIDTH = VIEWPORT.phone.width;

test(
  'FR7: loading — no horizontal scroll, heading and both placeholder cards inside the viewport',
  { tag: '@regression' },
  async ({ page }) => {
    // Never answered: the loading state holds still while it is measured.
    await installClientsDouble(page, { mode: 'hang' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.status).toHaveText(TEXT.loading);
    await expect(ui.tableCard).toBeVisible();

    expect(await scrollWidthOf(page)).toBeLessThanOrEqual(WIDTH);
    expect(await rightEdgeOf([ui.heading, ui.chartCard, ui.tableCard])).toBeLessThanOrEqual(WIDTH);
  },
);

test(
  'FR7: failed — no horizontal scroll, the panel inside the viewport, Retry visible and clickable',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { mode: 'fail' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.alert).toContainText(TEXT.message);

    expect(await scrollWidthOf(page)).toBeLessThanOrEqual(WIDTH);
    expect(await rightEdgeOf([ui.heading, ui.alert, ui.retry])).toBeLessThanOrEqual(WIDTH);
    await expect(ui.retry).toBeInViewport({ ratio: 1 });
    // The message is not clipped: the text block is as wide as its longest line needs.
    expect(await ui.alert.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    await ui.retry.click();
    await expect(ui.status).toHaveText(TEXT.loading);
  },
);

test(
  'FR7: loaded — no horizontal scroll, both summaries fully readable',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.tableCard).toHaveText(TEXT.branches);

    expect(await scrollWidthOf(page)).toBeLessThanOrEqual(WIDTH);
    expect(await rightEdgeOf([ui.heading, ui.chartCard, ui.tableCard])).toBeLessThanOrEqual(WIDTH);
    for (const card of [ui.chartCard, ui.tableCard]) {
      const summary = card.getByRole('paragraph');
      await expect(summary).toBeVisible();
      expect(await summary.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  },
);
