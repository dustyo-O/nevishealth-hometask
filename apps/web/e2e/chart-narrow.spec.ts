// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR8 "Narrow screens": the whole year at 375 px — every bar inside the card, labels thinned to
// every third month (FR8-AC2 as amended 2026-09-23), the plot the same height as at the design's
// width, and nothing that scrolls sideways at either width.
import { expect, test, type Page } from '@playwright/test';
import { openChart, readDrawing, type Chart } from './support/chart';
import { scrollWidthOf, VIEWPORT } from './support/clients-page';
import { MONTH_HEADINGS } from './support/table';

const at = async (page: Page, width: keyof typeof VIEWPORT): Promise<Chart> => {
  await page.setViewportSize(VIEWPORT[width]);
  return openChart(page);
};

test(
  'FR8-AC1: at 375 px all twelve bars are visible inside the card and none is cut off',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await at(page, 'phone');
    const card = (await chart.ui.chartCard.boundingBox())!;
    const { bars } = await readDrawing(chart);
    expect(bars).toHaveLength(12);
    for (const bar of bars) {
      // Never a count of parts: a part that is zero that month draws nothing (004 §2.7).
      expect(bar.length).toBeGreaterThan(0);
      for (const segment of bar) {
        expect(segment.width).toBeGreaterThan(0);
        expect(segment.height).toBeGreaterThan(0);
        expect(segment.x).toBeGreaterThanOrEqual(card.x);
        expect(segment.x + segment.width).toBeLessThanOrEqual(card.x + card.width);
      }
    }
    // Inside the viewport, too.
    const last = bars[11]![0]!;
    expect(last.x + last.width).toBeLessThanOrEqual(VIEWPORT.phone.width);
  },
);

test(
  'FR8-AC2: at 375 px the labels read "Apr 2024", "Jul 2024", "Oct 2024" and "Jan 2025", evenly spaced, none overlapping',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await at(page, 'phone');
    const drawn = await readDrawing(chart);
    expect(drawn.xTicks.map(({ text }) => text)).toEqual([
      'Apr 2024',
      'Jul 2024',
      'Oct 2024',
      'Jan 2025',
    ]);
    const centres = drawn.xTicks.map(({ rect }) => rect.x + rect.width / 2);
    const gaps = centres.slice(1).map((c, i) => c - centres[i]!);
    for (const gap of gaps) expect(Math.abs(gap - gaps[0]!)).toBeLessThan(1);
    drawn.xTicks.slice(1).forEach(({ rect }, i) => {
      const before = drawn.xTicks[i]!.rect;
      expect(rect.x).toBeGreaterThan(before.x + before.width);
    });
    // Each still names the bar it stands under.
    const barCentres = drawn.bars.map((bar) => bar[0]!.x + bar[0]!.width / 2);
    for (const [i, index] of [2, 5, 8, 11].entries()) {
      expect(Math.abs(centres[i]! - barCentres[index]!)).toBeLessThan(2);
    }
  },
);

test(
  'FR8-AC3: at 375 px the plot is the same height as at the design’s width, and the page has no horizontal scrollbar',
  { tag: '@regression' },
  async ({ page }) => {
    const wide = await at(page, 'desktop');
    const wideHeight = (await wide.group.boundingBox())!.height;
    const wideSvg = (await wide.svg.boundingBox())!.height;

    const narrow = await at(page, 'phone');
    expect((await narrow.group.boundingBox())!.height).toBe(wideHeight);
    expect((await narrow.svg.boundingBox())!.height).toBe(wideSvg);
    // With the real legend rendered beneath it (tech review F3).
    // 004 slice 3 replaces the entries; FR5 of 004 wants the plot's height untouched however many.
    await expect(narrow.legend.getByRole('listitem')).toHaveCount(4);
    expect(await scrollWidthOf(page)).toBe(VIEWPORT.phone.width);
  },
);

for (const width of ['phone', 'desktop'] as const) {
  test(
    `FR8-AC4: at ${VIEWPORT[width].width} px, trying to scroll the chart sideways moves nothing`,
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await at(page, width);
      const before = await readDrawing(chart);
      const plot = (await chart.group.boundingBox())!;
      await page.mouse.move(plot.x + plot.width / 2, plot.y + plot.height / 2);
      await page.mouse.wheel(400, 0);
      await page.waitForTimeout(200);

      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      // Nothing between the card and the drawing can scroll sideways either.
      const scrollers = await chart.ui.chartCard.evaluate((card) =>
        [card, ...card.querySelectorAll('*')]
          .filter((el) => el instanceof HTMLElement)
          // Scrolled already, or able to: overflowing inside a box that scrolls on its own.
          .filter(
            (el) =>
              el.scrollLeft !== 0 ||
              (['auto', 'scroll'].includes(getComputedStyle(el).overflowX) &&
                el.scrollWidth > el.clientWidth),
          )
          .map((el) => el.className),
      );
      expect(scrollers).toEqual([]);
      expect((await readDrawing(chart)).bars).toEqual(before.bars);
    },
  );
}

test(
  'FR8-AC5: at the design’s width all twelve months are named beneath their bars',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await at(page, 'desktop');
    const drawn = await readDrawing(chart);
    expect(drawn.xTicks.map(({ text }) => text)).toEqual([...MONTH_HEADINGS]);
    drawn.xTicks.slice(1).forEach(({ rect }, i) => {
      const before = drawn.xTicks[i]!.rect;
      expect(rect.x).toBeGreaterThan(before.x + before.width);
    });
  },
);
