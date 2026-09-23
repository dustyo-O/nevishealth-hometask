// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR1–FR3 "The chart, its months and its three parts", "The scale and the grid", "The legend",
// on the shipped data in a real browser. Every figure is read from what is drawn — a segment's
// height against the labelled axis — never from the widget's state (support/chart.ts).
import { expect, test } from '@playwright/test';
import {
  FEBRUARY,
  CHANNELS,
  expectBarShows,
  figuresOf,
  FLOOR_PX,
  januaryRaisedBy,
  openChart,
  readBars,
  readDrawing,
  type Chart,
  type Segment,
} from './support/chart';
import { MONTH_HEADINGS, shippedClients } from './support/table';

/** The part tokens as the browser computes them (003 §2.2). */
const COLOURS = {
  'Existing clients': 'rgb(178, 157, 248)',
  'New organic': 'rgb(244, 190, 180)',
  'New paid': 'rgb(167, 94, 110)',
} as const;

/** Each bar's parts from the bottom up, as painted. */
const bottomUp = (bar: Segment[]) => [...bar].sort((a, b) => b.y + b.height - (a.y + a.height));

const yLabels = async (chart: Chart) => (await readDrawing(chart)).yTicks.map(({ text }) => text);

// Each part wherever it is not zero — never a count of rectangles (004 §2.7).
test(
  'FR1-AC1: twelve bars labelled "Feb 2024" through "Jan 2025" in order, each divided into its parts',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const drawn = await readDrawing(chart);
    const months = figuresOf(shippedClients());

    expect(drawn.xTicks.map(({ text }) => text)).toEqual([...MONTH_HEADINGS]);
    expect(drawn.bars).toHaveLength(12);
    drawn.bars.forEach((bar, i) => {
      const drawnParts = bar.map(({ name }) => name).sort();
      const nonZero = CHANNELS.filter((part) => months[i]![part] > 0);
      expect(drawnParts).toEqual([...nonZero].sort());
    });
    // Each label sits beneath its own bar.
    drawn.bars.forEach((bar, i) => {
      const centre = bar[0]!.x + bar[0]!.width / 2;
      const label = drawn.xTicks[i]!.rect;
      expect(Math.abs(label.x + label.width / 2 - centre)).toBeLessThan(2);
    });
  },
);

test(
  'FR1-AC3: February 2024 reads 250 existing clients, 0 new organic and 0 new paid, totalling 250',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    expect(figuresOf(shippedClients())[0]).toEqual(FEBRUARY);
    // Nothing new to floor in February: its one part is drawn exactly to scale (FR4-AC2).
    const { bars, perClient } = await readBars(chart);
    expectBarShows(bars[0]!, FEBRUARY, perClient, 'Feb 2024');
    expect(bars[0]!.reach).toBeCloseTo(250, 1);
  },
);

test(
  'FR1-AC4: August 2024 and January 2025 are the tallest bars, each totalling 350',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const { bars, perClient } = await readBars(chart);
    const figures = figuresOf(shippedClients());
    // Read as drawn, each within the floor of its figure (FR4) — and the floor is too small to
    // lift any other month (July, 334) up to them.
    const byReach = bars.map(({ reach }, i) => ({ reach, i })).sort((a, b) => b.reach - a.reach);
    expect(
      byReach
        .slice(0, 2)
        .map(({ i }) => MONTH_HEADINGS[i])
        .sort(),
    ).toEqual(['Aug 2024', 'Jan 2025']);
    for (const { i } of byReach.slice(0, 2)) {
      expect(figures[i]!.total).toBe(350);
      expectBarShows(bars[i]!, figures[i]!, perClient, MONTH_HEADINGS[i]!);
    }
    expect(byReach[2]!.reach).toBeLessThan(350);
  },
);

test(
  'FR1-AC5: from the bottom up, every bar is Existing clients, then New organic, New paid — each resting on the last',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const drawn = await readDrawing(chart);
    const floor = Math.max(...drawn.gridlines);
    for (const bar of drawn.bars) {
      const parts = bottomUp(bar);
      const names = parts.map(({ name }) => name);
      // In stacking order, whichever parts this month draws.
      expect(names).toEqual(CHANNELS.filter((part) => names.includes(part)));
      // Stacked: each part starts where the one beneath it ends. A part floored to FLOOR_PX
      // (FR4) grows upward from its start, so the part above may overlap it by up to the floor —
      // never more, and never a gap (see FLOOR_PX in support/chart.ts before tightening this).
      expect(Math.abs(parts[0]!.y + parts[0]!.height - floor)).toBeLessThan(0.5);
      parts.slice(1).forEach((part, i) => {
        const overlap = part.y + part.height - parts[i]!.y;
        expect(overlap).toBeGreaterThan(-0.5);
        expect(overlap).toBeLessThan(FLOOR_PX + 0.5);
      });
      // And each part keeps the colour the design gives it.
      for (const segment of bar)
        expect(segment.fill).toBe(COLOURS[segment.name as keyof typeof COLOURS]);
    }
  },
);

test(
  'FR2-AC1/AC2: the scale starts at 0 in equal steps of one hundred, its top label is 400, and no bar reaches the top of the plot',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const drawn = await readDrawing(chart);
    // Top to bottom as painted.
    expect(drawn.yTicks.map(({ text }) => text)).toEqual(['400', '300', '200', '100', '0']);
    // Equal steps on the page too, not just in the labels.
    const steps = drawn.gridlines.slice(1).map((y, i) => y - drawn.gridlines[i]!);
    for (const step of steps) expect(Math.abs(step - steps[0]!)).toBeLessThan(0.5);
    const ceiling = Math.min(...drawn.gridlines);
    const tallestTop = Math.min(...drawn.bars.flat().map(({ y }) => y));
    // Clear of the ceiling by at least the 50 clients between 350 and 400.
    expect(tallestTop - ceiling).toBeGreaterThan(steps[0]! / 2 - 1);
  },
);

test(
  'FR2-AC3/AC4: a faint dotted line runs across the plot at each labelled step, and nothing is drawn between the months',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const drawn = await readDrawing(chart);
    expect(drawn.gridlines).toHaveLength(drawn.yTicks.length);
    drawn.gridlines.forEach((y, i) => expect(Math.abs(y - drawn.yTicks[i]!.y)).toBeLessThan(3));
    expect(drawn.verticals).toBe(0);

    const lines = chart.svg.locator('.recharts-cartesian-grid line');
    await expect(lines).toHaveCount(5);
    for (const line of await lines.all()) {
      const style = await line.evaluate((el) => {
        const { strokeDasharray, stroke } = getComputedStyle(el);
        const { x1, x2, y1, y2 } = el as SVGLineElement;
        return {
          strokeDasharray,
          stroke,
          horizontal:
            y1.baseVal.value === y2.baseVal.value && x1.baseVal.value !== x2.baseVal.value,
        };
      });
      expect(style.horizontal).toBe(true);
      expect(style.strokeDasharray).not.toBe('none');
      // Faint: the design's dotted-line token, never the bars' ink.
      expect(Object.values(COLOURS)).not.toContain(style.stroke);
    }
  },
);

test(
  'FR2-AC5: a month above the top moves the top to the first step above it',
  { tag: '@regression' },
  async ({ page }) => {
    // January 350 → 420: the scale reads to 500, and the tallest bar still sits under the ceiling.
    const chart = await openChart(page, { body: januaryRaisedBy(70) });
    expect(await yLabels(chart)).toEqual(['500', '400', '300', '200', '100', '0']);
    const { bars, perClient } = await readBars(chart);
    const january = figuresOf(januaryRaisedBy(70))[11]!;
    expect(january.total).toBe(420);
    expectBarShows(bars[11]!, january, perClient, 'Jan 2025');
    const drawn = await readDrawing(chart);
    expect(Math.min(...drawn.bars.flat().map(({ y }) => y))).toBeGreaterThan(
      Math.min(...drawn.gridlines),
    );
  },
);

test(
  'FR2-AC5, the boundary: a month exactly on a step still gets a step above it — 400 reads to 500, never touching the ceiling',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page, { body: januaryRaisedBy(50) });
    expect(await yLabels(chart)).toEqual(['500', '400', '300', '200', '100', '0']);
    const { bars, perClient } = await readBars(chart);
    const january = figuresOf(januaryRaisedBy(50))[11]!;
    expect(january.total).toBe(400);
    expectBarShows(bars[11]!, january, perClient, 'Jan 2025');
  },
);

/** Where the legend's entries are painted, and each swatch's size and colour. */
const readLegend = (chart: Chart) =>
  chart.legend.evaluate((list) => {
    const items = [...list.children].map((item) => item.getBoundingClientRect());
    const swatches = [...list.querySelectorAll('li > span')].map((swatch) => {
      const { width, height } = swatch.getBoundingClientRect();
      return { width, height, colour: getComputedStyle(swatch).backgroundColor };
    });
    return {
      left: Math.min(...items.map(({ left }) => left)),
      right: Math.max(...items.map(({ right }) => right)),
      top: Math.min(...items.map(({ top }) => top)),
      swatches,
    };
  });

test(
  'FR3-AC1: a legend centred beneath the chart names exactly the three parts, each with a small swatch',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await expect(chart.legend.getByRole('listitem')).toHaveText([...CHANNELS]);
    const legend = await readLegend(chart);
    for (const swatch of legend.swatches) {
      // Small: a swatch, not a bar.
      expect(swatch.width).toBeGreaterThan(0);
      expect(swatch.width).toBeLessThanOrEqual(12);
    }
    const card = await chart.ui.chartCard.boundingBox();
    const svg = await chart.svg.boundingBox();
    expect(legend.top).toBeGreaterThanOrEqual(svg!.y + svg!.height);
    // Centred on the card, as painted: the entries themselves, not the list's box.
    const offset = (legend.left + legend.right) / 2 - (card!.x + card!.width / 2);
    expect(Math.abs(offset)).toBeLessThanOrEqual(2);
  },
);

test(
  'FR3-AC2: each legend swatch is the colour of the part it names in every bar',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const legend = await readLegend(chart);
    const drawn = await readDrawing(chart);
    expect(legend.swatches).toHaveLength(CHANNELS.length);
    legend.swatches.forEach((swatch, i) => {
      const channel = CHANNELS[i]!;
      const fills = new Set(
        drawn.bars
          .flat()
          .filter(({ name }) => name === channel)
          .map(({ fill }) => fill),
      );
      expect([...fills]).toEqual([swatch.colour]);
      expect(swatch.colour).toBe(COLOURS[channel]);
    });
  },
);

test(
  'FR3-AC3: clicking each legend entry changes nothing about the chart',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const before = await readDrawing(chart);
    for (const entry of await chart.legend.getByRole('listitem').all()) {
      await entry.click();
      // Not a control: nothing to press, nothing pressed.
      await expect(entry).not.toHaveAttribute('aria-pressed');
    }
    await expect(chart.legend.getByRole('button')).toHaveCount(0);
    expect(await readDrawing(chart)).toEqual(before);
  },
);

test(
  'FR4-AC1: July 2024’s new organic and new paid are drawn at least FLOOR_PX tall, not hairlines',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const july = (await readDrawing(chart)).bars[5]!;
    const { perClient } = await readBars(chart);
    // To scale, 2 clients and 1 client would be under FLOOR_PX: that is why the floor exists.
    expect(2 * perClient).toBeLessThan(FLOOR_PX);
    for (const part of ['New organic', 'New paid']) {
      const segment = july.find(({ name }) => name === part);
      expect(segment?.height, part).toBeGreaterThanOrEqual(FLOOR_PX - 0.01);
    }
  },
);

test(
  'FR4-AC2: February 2024, where nobody was newly acquired, draws no new organic or new paid part at all',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const february = (await readDrawing(chart)).bars[0]!;
    expect(february.filter(({ height }) => height > 0).map(({ name }) => name)).toEqual([
      'Existing clients',
    ]);
  },
);
