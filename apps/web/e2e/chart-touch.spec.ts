// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR4 on a touch screen at 375 px — and tech review F2, the regression that moved the dismissal
// rule from the widget's root to the plot: a tap on the legend, on the card's padding, or on the
// table card must each close the panel. Taps are real touch input (`touchscreen.tap`), so the
// page sees `pointerType: 'touch'` with no hover before it.
import { expect, test, type Page } from '@playwright/test';
import {
  columnPoint,
  expectNothingRead,
  expectReading,
  expectTintOver,
  FEBRUARY_PANEL,
  openChart,
  readDrawing,
  readPanel,
  type Chart,
} from './support/chart';
import { VIEWPORT } from './support/clients-page';

test.use({ viewport: VIEWPORT.phone, hasTouch: true, isMobile: true });

const tapMonth = async (page: Page, chart: Chart, index: number, height?: 'top') => {
  const { x, y } = await columnPoint(chart, index, height);
  await page.touchscreen.tap(x, y);
};

/** Opens February's panel with a tap and confirms it is open. */
const openFebruary = async (page: Page): Promise<Chart> => {
  const chart = await openChart(page);
  await tapMonth(page, chart, 0);
  await expectReading(chart, '2024-02');
  return chart;
};

test('FR4-AC4: tapping a month shows its panel', { tag: '@regression' }, async ({ page }) => {
  const chart = await openFebruary(page);
  expect(await readPanel(chart)).toEqual(FEBRUARY_PANEL);
  await expectTintOver(chart, 0);
  // A tap is not a focus: the outline stays where it was, and nothing lands in the drawing.
  const inDrawing = await chart.drawing.evaluate((d) => d.contains(document.activeElement));
  expect(inDrawing).toBe(false);
});

test(
  'FR4-AC5: with a panel open, tapping a different month replaces it with that month’s figures',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openFebruary(page);
    await tapMonth(page, chart, 7);
    await expectReading(chart, '2024-09');
    await expectTintOver(chart, 7);
    expect((await readPanel(chart)).month).toBe('Sep 2024');
  },
);

test(
  'FR4: a tap anywhere in a month’s column, above its bar too, selects that month',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openFebruary(page);
    const drawn = await readDrawing(chart);
    const { y } = await columnPoint(chart, 3, 'top');
    // Above April's bar, not on it.
    expect(y).toBeLessThan(Math.min(...drawn.bars[3]!.map((segment) => segment.y)));
    await tapMonth(page, chart, 3, 'top');
    await expectReading(chart, '2024-05');
  },
);

test(
  'FR4-AC6 / tech review F2: with a panel open, tapping the legend dismisses the panel and the tint',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openFebruary(page);
    await chart.legend.getByRole('listitem').nth(1).tap();
    await expectNothingRead(chart);
  },
);

test(
  'FR4-AC7 / tech review F2: with a panel open, tapping the space around the chart inside its card dismisses it',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openFebruary(page);
    const card = (await chart.ui.chartCard.boundingBox())!;
    const plot = (await chart.group.boundingBox())!;
    // The card's top padding, above the middle of the plot — inside the card, outside the plot.
    // Kept 20 px clear of the plot on purpose: Chromium's touch adjustment snaps a tap a few
    // pixels from the drawing onto its focusable SVG layers (measured at 8 px from the left
    // edge), which would make this a tap on the axis instead of on the padding.
    const y = card.y + 4;
    expect(plot.y - y).toBeGreaterThanOrEqual(20);
    const target = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest('[role="group"]') ?? null,
      [plot.x + plot.width / 2, y],
    );
    expect(target).toBeNull();
    await page.touchscreen.tap(plot.x + plot.width / 2, y);
    await expectNothingRead(chart);
  },
);

test(
  'FR4 / tech review F2: with a panel open, tapping the table card beneath dismisses it',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openFebruary(page);
    const table = (await chart.ui.tableCard.boundingBox())!;
    // The card's top-left padding: no row, nothing to open.
    await page.touchscreen.tap(table.x + 6, table.y + 6);
    await expectNothingRead(chart);
    // Nothing in the table moved either.
    await expect(chart.ui.rowNames).toHaveText(['Company', 'Branch 1', 'Branch 2', 'Branch 3']);
  },
);

test(
  'FR4: with a panel open, tapping the month labels beneath the plot dismisses it',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openFebruary(page);
    const label = (await readDrawing(chart)).xTicks[0]!.rect;
    await page.touchscreen.tap(label.x + label.width / 2, label.y + label.height / 2);
    await expectNothingRead(chart);
  },
);

test(
  'FR4: a tapped panel stays open after the finger lifts, and stays inside the card for every month',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const card = (await chart.ui.chartCard.boundingBox())!;
    for (let index = 0; index < 12; index += 1) {
      await tapMonth(page, chart, index);
      await page.waitForTimeout(100);
      await expect(chart.panel).toHaveCount(1);
      const box = (await chart.panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(card.x);
      expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width);
    }
  },
);
