// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR7 "Nothing breaks at 375 px": in all three states, no horizontal scrollbar, no content cut
// off, the Retry button reachable.
import { expect, test } from '@playwright/test';
import { installClientsDouble } from './support/clients-double';
import {
  clientsPage,
  expectTableLoaded,
  rightEdgeOf,
  scrollWidthOf,
  TEXT,
  VIEWPORT,
  expectChartLoaded,
} from './support/clients-page';

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
    const double = await installClientsDouble(page, { mode: 'fail' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.alert).toContainText(TEXT.message);

    expect(await scrollWidthOf(page)).toBeLessThanOrEqual(WIDTH);
    expect(await rightEdgeOf([ui.heading, ui.alert, ui.retry])).toBeLessThanOrEqual(WIDTH);
    await expect(ui.retry).toBeInViewport({ ratio: 1 });
    // The message is not clipped: the text block is as wide as its longest line needs.
    expect(await ui.alert.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    // The button is reachable and it works: this failure returns too quickly to be announced
    // (FR3 amended 2026-09-22), so what Retry did is counted, not read.
    const requestsBefore = double.requests.length;
    await ui.retry.click();
    await expect.poll(() => double.requests.length).toBeGreaterThan(requestsBefore);
  },
);

test(
  'FR7: loaded — no horizontal scroll, the chart inside its card and every row name on screen',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/');
    await expectTableLoaded(ui);

    expect(await scrollWidthOf(page)).toBeLessThanOrEqual(WIDTH);
    expect(await rightEdgeOf([ui.heading, ui.chartCard, ui.tableCard])).toBeLessThanOrEqual(WIDTH);

    // The chart stands where the period line stood (003 FR9), inside the card, not past it.
    await expectChartLoaded(ui);
    expect(await rightEdgeOf([ui.chart])).toBeLessThanOrEqual(WIDTH);

    // The lower card holds the table since spec 002 FR7. Its months scroll sideways inside their
    // own box — which is exactly why the page above them still does not — and the name column
    // stays where the reader can see it, every row of it inside the viewport (002 FR6-AC1).
    expect(await rightEdgeOf(await ui.rowNames.all())).toBeLessThanOrEqual(WIDTH);
  },
);
