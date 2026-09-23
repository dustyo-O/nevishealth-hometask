// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR4 "Pointing at a month" with a mouse at the design's width. The panel and the tint are read
// as they are painted; the month under them is checked against the bar they stand over. Touch is
// its own file (chart-touch.spec.ts).
import { expect, test } from '@playwright/test';
import {
  columnPoint,
  expectNothingRead,
  expectReading,
  expectTintOver,
  FEBRUARY_PANEL,
  FEBRUARY_SAID,
  expectBarShows,
  figuresOf,
  hoverMonth,
  openChart,
  readBars,
  readDrawing,
  readPanel,
  CHANNELS,
} from './support/chart';
import { MONTHS } from './support/clients-double';
import { MONTH_HEADINGS, shippedClients } from './support/table';

test(
  'FR4-AC1: pointing at February 2024 opens a panel reading "Feb 2024", 250, 0, 0 and a total of 250, in stacking order',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await hoverMonth(chart, 0);
    await expectReading(chart, '2024-02');
    expect(await readPanel(chart)).toEqual(FEBRUARY_PANEL);
    await expect(chart.panel).toBeVisible();
  },
);

test(
  'FR4-AC2: pointing at a month tints that month’s column and leaves the other eleven unchanged',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const before = await readDrawing(chart);
    for (const index of [0, 5, 11]) {
      await hoverMonth(chart, index);
      await expectReading(chart, MONTHS[index]!);
      await expectTintOver(chart, index);
      // The tint is behind the bars and paints no bar of its own: every bar is as it was.
      expect((await readDrawing(chart)).bars).toEqual(before.bars);
    }
  },
);

test(
  'FR4-AC3: moving the pointer off the chart hides the panel and the tint',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await hoverMonth(chart, 3);
    await expectReading(chart, '2024-05');
    const card = (await chart.ui.chartCard.boundingBox())!;
    await page.mouse.move(card.x + card.width / 2, card.y + card.height + 40);
    await expectNothingRead(chart);
  },
);

test(
  'FR4-AC3, fast exits: twenty quick trips in and out of the chart leave nothing behind',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const inside = await columnPoint(chart, 6);
    const card = (await chart.ui.chartCard.boundingBox())!;
    for (let i = 0; i < 20; i += 1) {
      await page.mouse.move(inside.x, inside.y, { steps: 1 });
      await page.mouse.move(card.x + card.width / 2, card.y - 30, { steps: 1 });
    }
    await expectNothingRead(chart);
  },
);

test(
  'FR4: pointing at the axes around the columns reads no month',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const drawn = await readDrawing(chart);
    // The "200" label on the y-axis, left of every column.
    const label = drawn.yTicks.find(({ text }) => text === '200')!;
    const svg = (await chart.svg.boundingBox())!;
    await page.mouse.move(svg.x + 8, label.y);
    await expectNothingRead(chart);
  },
);

test(
  'FR4-AC9: for every month, the panel’s figures add up to the total it shows — and to the bar drawn',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const { bars, perClient } = await readBars(chart);
    const months = figuresOf(shippedClients());
    for (const [index, heading] of MONTH_HEADINGS.entries()) {
      await hoverMonth(chart, index);
      await expectReading(chart, MONTHS[index]!);
      const panel = await readPanel(chart);
      expect(panel.month).toBe(heading);
      expect(panel.rows.map(([name]) => name)).toEqual([...CHANNELS, 'Total']);
      const values = panel.rows.map(([, value]) => value);
      const total = values.pop();
      expect(values.reduce((sum, value) => sum + value, 0)).toBe(total);
      expect(total).toBe(months[index]!.total);
      // And the bar drawn shows the panel's figures — the total exactly, the parts within the floor only (FR4).
      const [existing, organic, paid] = values;
      expectBarShows(
        bars[index]!,
        {
          'Existing clients': existing!,
          'New organic': organic!,
          'New paid': paid!,
          total: total!,
        },
        perClient,
        heading,
      );
      // The panel stays inside the card for every month.
      const card = (await chart.ui.chartCard.boundingBox())!;
      const box = (await chart.panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(card.x);
      expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width);
    }
  },
);

test(
  'FR6-AC3 by pointer: a pointer sweeping the year announces nothing — the live region speaks for the outline only',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    for (const index of [0, 4, 8, 11]) {
      await hoverMonth(chart, index);
      await expectReading(chart, MONTHS[index]!);
      await expect(chart.live).toHaveText('');
    }
    // It is the same region the outline speaks into.
    await page.mouse.move(0, 0);
    await chart.ui.heading.click();
    await page.keyboard.press('Tab');
    await expect(chart.live).toHaveText(FEBRUARY_SAID);
  },
);
