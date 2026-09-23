// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR8-AC3 (added 2026-09-23 by the code review's F1): at every width from 375 to 1440 the month
// labels never overlap, the set always ends at "Jan 2025", and the number shown only grows as the
// chart gets wider. The chart does not pick its labels — the library thins them — and the owner
// declined explicit tick selection, so this sweep is what guards the behaviour instead. It reads
// the painted label boxes, never the library's configuration.
import { expect, test, type Page } from '@playwright/test';
import { openChart, readDrawing, type Chart, type Drawn } from './support/chart';
import { MONTH_HEADINGS } from './support/table';

const NARROWEST = 375;
const WIDEST = 1440;
const HEIGHT = 900;
const SUBPIXEL = 0.5;

/**
 * Viewport widths at which the label count went up, measured in Chromium on 2026-09-23 with a 1 px
 * sweep: 4 → 5 at 472, → 6 at 481, → 7 at 806, → 8 at 835, → 9 at 837, → 10 at 847, → 11 at 849,
 * → 12 at 850. Both sides of each are swept 1 px at a time; a different engine or font may move
 * them, which is why they only choose where to look closely — the assertions hold at any width.
 */
const MEASURED_STEPS = [472, 481, 806, 835, 837, 847, 849, 850] as const;

const range = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Every 20 px across the range, plus every pixel within 4 px of a measured step. */
const WIDTHS = [
  ...new Set([
    ...range(NARROWEST, WIDEST, 20),
    WIDEST,
    ...MEASURED_STEPS.flatMap((step) => range(step - 4, step + 4, 1)),
  ]),
]
  .filter((width) => width >= NARROWEST && width <= WIDEST)
  .sort((a, b) => a - b);

type Reading = { width: number; labels: Drawn['xTicks']; svg: { x: number; width: number } };

/**
 * Resizes to `width` and reads the labels once the drawing has caught up: the SVG has taken the
 * plot box's new width and two readings in a row agree.
 */
const readAt = async (page: Page, chart: Chart, width: number): Promise<Reading> => {
  await page.setViewportSize({ width, height: HEIGHT });
  let previous = '';
  let reading: Reading | undefined;
  await expect
    .poll(
      async () => {
        const [drawn, svg, plot] = await Promise.all([
          readDrawing(chart),
          chart.svg.boundingBox(),
          chart.group.evaluate((group) => group.clientWidth),
        ]);
        reading = { width, labels: drawn.xTicks, svg: { x: svg!.x, width: svg!.width } };
        const now = JSON.stringify(reading);
        const settled = Math.abs(svg!.width - plot) < 1 && now === previous;
        previous = now;
        return settled;
      },
      { message: `the chart never settled at ${width} px`, intervals: [16] },
    )
    .toBe(true);
  return reading!;
};

const expectLabelsSound = ({ width, labels, svg }: Reading): void => {
  const texts = labels.map(({ text }) => text);
  const at = `at ${width} px: ${texts.join(' | ')}`;

  // Each is a month's full name, in the year's order, and the set ends at January 2025.
  expect(texts.length, at).toBeGreaterThan(0);
  for (const text of texts) expect(MONTH_HEADINGS, at).toContain(text);
  expect(texts, at).toEqual(MONTH_HEADINGS.filter((month) => texts.includes(month)));
  expect(texts.at(-1), at).toBe('Jan 2025');

  // No two painted boxes touch, and none is clipped at the drawing's edges. "Jan 2025" is set flush
  // with the right edge, and its glyph box has been measured 0.07 px past it — half a pixel is
  // allowed for that, since no pixel is lost to it.
  labels.slice(1).forEach(({ rect }, i) => {
    const before = labels[i]!.rect;
    expect(rect.x, `${at} — "${labels[i]!.text}" touches "${labels[i + 1]!.text}"`).toBeGreaterThan(
      before.x + before.width,
    );
  });
  for (const { text, rect } of labels) {
    expect(rect.width, `${at} — "${text}" is not painted`).toBeGreaterThan(0);
    expect(rect.x, `${at} — "${text}" is cut off`).toBeGreaterThanOrEqual(svg.x - SUBPIXEL);
    expect(rect.x + rect.width, `${at} — "${text}" is cut off`).toBeLessThanOrEqual(
      svg.x + svg.width + SUBPIXEL,
    );
  }
};

test(
  'FR8-AC3: from 375 px to 1440 px the labels never overlap, always end at "Jan 2025", and only grow in number as the chart widens',
  { tag: '@regression' },
  async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: NARROWEST, height: HEIGHT });
    const chart = await openChart(page);

    const widening: Reading[] = [];
    for (const width of WIDTHS) {
      const reading = await readAt(page, chart, width);
      expectLabelsSound(reading);
      const before = widening.at(-1);
      if (before !== undefined) {
        expect(
          reading.labels.length,
          `${before.labels.length} labels at ${before.width} px but ${reading.labels.length} at ${width} px`,
        ).toBeGreaterThanOrEqual(before.labels.length);
      }
      widening.push(reading);
    }

    // The ends of the range are what FR8 names: four at 375, all twelve at 1440.
    expect(widening[0]!.labels).toHaveLength(4);
    expect(widening.at(-1)!.labels).toHaveLength(12);
    // It steps rather than jumping straight from twelve to every third month (FR8 as amended).
    expect(new Set(widening.map(({ labels }) => labels.length)).size).toBeGreaterThan(2);

    // Narrowing again lands on the same labels at every width: what is shown depends on the
    // width alone, not on the way the window got there.
    for (const reading of widening.slice(0, -1).reverse()) {
      const again = await readAt(page, chart, reading.width);
      expect(
        again.labels.map(({ text }) => text),
        `narrowing to ${reading.width} px`,
      ).toEqual(reading.labels.map(({ text }) => text));
    }
  },
);
