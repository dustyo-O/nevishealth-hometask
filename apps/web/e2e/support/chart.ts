import { expect, type Locator, type Page } from '@playwright/test';
import type { Item } from './clients-double';
import { clientsPage, type ClientsPage } from './clients-page';
import { openTable, shippedClients, type ClientsBody } from './table';

/**
 * Spec 003's browser suite reads the chart the way a person does — from what is drawn — and never
 * from the widget's state. Bars are read as pixels against the axis the drawing labels, so a
 * figure "on the chart" means a height a sighted user could measure, not a number in the DOM.
 */

/** Bottom-up stacking order and the names the legend and the panel use (FR1-AC5, FR3-AC1). */
export const CHANNELS = ['Existing clients', 'New organic', 'New paid'] as const;
export type Channel = (typeof CHANNELS)[number];

/** February 2024 as FR1-AC3 and FR4-AC1 name it. */
export const FEBRUARY = { 'Existing clients': 221, 'New organic': 15, 'New paid': 14, total: 250 };

/** The live region's sentence for February (FR6-AC1), exactly as `describeMonth` words it. */
export const FEBRUARY_SAID =
  'Feb 2024: existing clients 221, new organic 15, new paid 14, total 250';

export const CHART_NAME = 'Clients per month by acquisition channel, Feb 2024 to Jan 2025';

export type Chart = {
  ui: ClientsPage;
  /** The one focus stop: a named group that owns Left, Right and Escape (FR5, FR6-AC5). */
  group: Locator;
  /** Everything the library draws, plus the tint and the panel — hidden from assistive tech. */
  drawing: Locator;
  svg: Locator;
  /** The chart's own polite live region, not the page's (FR6-AC1). */
  live: Locator;
  /** The visually-hidden twelve-row table (FR6-AC2). */
  table: Locator;
  legend: Locator;
  /** The month column's tint — our element, placed from the widget's month (tech review F1). */
  tint: Locator;
  /** The month panel (FR4-AC1). */
  panel: Locator;
};

export const chartOf = (page: Page): Chart => {
  const ui = clientsPage(page);
  const group = ui.chartCard.getByRole('group', { name: CHART_NAME });
  const drawing = group.locator(':scope > [aria-hidden="true"]');
  return {
    ui,
    group,
    drawing,
    svg: drawing.locator('svg.recharts-surface'),
    live: ui.chartCard.getByRole('status'),
    table: ui.chartCard.getByRole('table', { name: CHART_NAME }),
    legend: ui.chartCard.getByRole('list'),
    // Both carry the month they show; only the panel has figures in it.
    tint: drawing.locator(':scope > [data-month]:not(:has(dl))'),
    panel: drawing.locator(':scope > [data-month]:has(dl)'),
  };
};

/**
 * Opens the dashboard on `body` (the shipped data by default) with motion reduced unless asked
 * otherwise, so the bars are at their final height the moment they are drawn (FR7-AC2).
 */
export const openChart = async (
  page: Page,
  {
    body = shippedClients(),
    motion = 'reduce',
  }: { body?: ClientsBody; motion?: 'reduce' | 'no-preference' } = {},
): Promise<Chart> => {
  await page.emulateMedia({ reducedMotion: motion });
  await openTable(page, body);
  const chart = chartOf(page);
  await expect(chart.svg).toBeVisible();
  // Three layers of twelve: the figures have been drawn.
  await expect(barPaths(chart)).toHaveCount(36);
  return chart;
};

export const barPaths = (chart: Chart): Locator =>
  chart.svg.locator('.recharts-bar path.recharts-rectangle');

export type Rect = { x: number; y: number; width: number; height: number };

export type Segment = Rect & { name: string; fill: string };

export type Drawn = {
  /** One entry per bar, left to right; each holds its segments in the order the layers draw them. */
  bars: Segment[][];
  /** The y of each horizontal gridline, top to bottom, in page pixels. */
  gridlines: number[];
  /** Any gridline running between the months. */
  verticals: number;
  /** The y-axis labels, top to bottom, with where they are painted. */
  yTicks: { text: string; y: number }[];
  /** The x-axis labels, left to right, with their painted boxes. */
  xTicks: { text: string; rect: Rect }[];
};

/** Everything the drawing shows, read from the rendered SVG in page coordinates. */
export const readDrawing = (chart: Chart): Promise<Drawn> =>
  chart.svg.evaluate((svg) => {
    const rectOf = (el: Element) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    };
    const layers = [...svg.querySelectorAll('.recharts-bar')];
    const byLayer = layers.map((layer) =>
      [...layer.querySelectorAll('path.recharts-rectangle')].map((path) => ({
        ...rectOf(path),
        name: path.getAttribute('name') ?? '',
        fill: getComputedStyle(path).fill,
      })),
    );
    // Group the segments into bars by where they stand, not by the order they were written.
    const columns = new Map<number, (typeof byLayer)[number]>();
    for (const segments of byLayer) {
      for (const segment of segments) {
        const key = Math.round(segment.x + segment.width / 2);
        columns.set(key, [...(columns.get(key) ?? []), segment]);
      }
    }
    const bars = [...columns.entries()].sort(([a], [b]) => a - b).map(([, segments]) => segments);

    const lineY = (line: Element) => {
      const { y, height } = line.getBoundingClientRect();
      return y + height / 2;
    };
    const gridlines = [...svg.querySelectorAll('.recharts-cartesian-grid-horizontal line')]
      .map(lineY)
      .sort((a, b) => a - b);
    const verticals = svg.querySelectorAll('.recharts-cartesian-grid-vertical line').length;

    const ticks = (axis: string) =>
      [
        ...svg.querySelectorAll(
          `.recharts-${axis}-tick-labels .recharts-cartesian-axis-tick-value`,
        ),
      ].map((text) => ({
        text: text.textContent ?? '',
        rect: rectOf(text),
      }));
    const yTicks = ticks('yAxis')
      .map(({ text, rect }) => ({ text, y: rect.y + rect.height / 2 }))
      .sort((a, b) => a.y - b.y);
    const xTicks = ticks('xAxis').sort((a, b) => a.rect.x - b.rect.x);
    return { bars, gridlines, verticals, yTicks, xTicks };
  });

export type MonthFigures = Record<Channel, number> & { total: number };

/**
 * Every bar's parts as numbers of clients, read as a person reads a chart: each segment's height
 * against the distance between the "0" and the top gridline and what the top label says.
 * `exactness` is how far the raw reading was from a whole client — a drawing that is right
 * lands within a hundredth.
 */
export const readBars = async (
  chart: Chart,
): Promise<{ months: MonthFigures[]; exactness: number }> => {
  const drawn = await readDrawing(chart);
  const top = Math.max(...drawn.yTicks.map(({ text }) => Number(text)));
  const ceiling = Math.min(...drawn.gridlines);
  const floor = Math.max(...drawn.gridlines);
  const perClient = (floor - ceiling) / top;
  let exactness = 0;
  const months = drawn.bars.map((segments) => {
    const figures = { total: 0 } as MonthFigures;
    for (const channel of CHANNELS) {
      const segment = segments.find(({ name }) => name === channel);
      const raw = segment === undefined ? 0 : segment.height / perClient;
      exactness = Math.max(exactness, Math.abs(raw - Math.round(raw)));
      figures[channel] = Math.round(raw);
    }
    const tallest = Math.min(...segments.map(({ y }) => y));
    const raw = (floor - tallest) / perClient;
    exactness = Math.max(exactness, Math.abs(raw - Math.round(raw)));
    figures.total = Math.round(raw);
    return figures;
  });
  return { months, exactness };
};

/** The centre of month `index`'s column, halfway up the plot — a point a pointer can rest on. */
export const columnPoint = async (
  chart: Chart,
  index: number,
  height: 'middle' | 'top' = 'middle',
): Promise<{ x: number; y: number }> => {
  const drawn = await readDrawing(chart);
  const bar = drawn.bars[index];
  if (bar === undefined) throw new Error(`no bar ${index}`);
  const x = bar[0]!.x + bar[0]!.width / 2;
  const ceiling = Math.min(...drawn.gridlines);
  const floor = Math.max(...drawn.gridlines);
  // "top": just under the top gridline, above every bar the data draws.
  const y = height === 'top' ? ceiling + 6 : (ceiling + floor) / 2 + 40;
  return { x, y };
};

export const hoverMonth = async (chart: Chart, index: number): Promise<void> => {
  const { x, y } = await columnPoint(chart, index);
  await chart.group.page().mouse.move(x, y);
};

/** What the open panel says: its month, each part it lists in order, and its total. */
export const readPanel = (chart: Chart) =>
  chart.panel.evaluate((panel) => ({
    month: panel.querySelector('p')?.textContent ?? '',
    rows: [...panel.querySelectorAll('dl > div')].map((row): [string, number] => [
      row.querySelector('dt')?.textContent ?? '',
      Number(row.querySelector('dd')?.textContent),
    ]),
  }));

/** The panel's reading of February, exactly as FR4-AC1 lists it. */
export const FEBRUARY_PANEL = {
  month: 'Feb 2024',
  rows: [
    ['Existing clients', 221],
    ['New organic', 15],
    ['New paid', 14],
    ['Total', 250],
  ],
};

/** "One month is being read, and it is `month`": exactly one tint and one panel, both on it. */
export const expectReading = async (chart: Chart, month: string): Promise<void> => {
  await expect(chart.tint).toHaveCount(1);
  await expect(chart.tint).toHaveAttribute('data-month', month);
  await expect(chart.panel).toHaveCount(1);
  await expect(chart.panel).toHaveAttribute('data-month', month);
};

/** Nothing is being read: no tint and no panel anywhere in the drawing. */
export const expectNothingRead = async (chart: Chart): Promise<void> => {
  await expect(chart.tint).toHaveCount(0);
  await expect(chart.panel).toHaveCount(0);
};

/** The tint stands over month `index`'s bar, and over no other bar (FR4-AC2). */
export const expectTintOver = async (chart: Chart, index: number): Promise<void> => {
  const drawn = await readDrawing(chart);
  const tint = await chart.tint.boundingBox();
  if (tint === null) throw new Error('no tint is drawn');
  const covered = drawn.bars
    .map((bar, i) => ({ i, centre: bar[0]!.x + bar[0]!.width / 2 }))
    .filter(({ centre }) => centre > tint.x && centre < tint.x + tint.width)
    .map(({ i }) => i);
  expect(covered).toEqual([index]);
};

/** Every channel node, wherever it hangs in the tree. */
const channelsOf = (node: Item): Item[] =>
  node.channels ??
  [...(node.branches ?? []), ...(node.employees ?? [])].flatMap((child) => channelsOf(child));

/** Recomputes every stored figure above the channels as the sum of its children's. */
const resum = (node: Item): number[] => {
  const children = node.channels ?? [...(node.branches ?? []), ...(node.employees ?? [])];
  if (children.length === 0) return node.values;
  const sums = node.values.map(() => 0);
  for (const child of children) resum(child).forEach((value, i) => (sums[i]! += value));
  node.values = sums;
  return sums;
};

/**
 * The shipped data with every channel figure changed by `change(value, channel, month)`, and every
 * stored total above it recomputed — the table's Company row stays the true sum, as it is in the
 * shipped data, so the two cards still describe the same company.
 */
export const reshaped = (
  change: (value: number, channel: string, month: number) => number,
): ClientsBody => {
  const body = shippedClients();
  for (const channel of channelsOf(body.company)) {
    channel.values = channel.values.map((value, month) => change(value, channel.name, month));
  }
  resum(body.company);
  return body;
};

/** Only January's first "New paid" channel moves, by `by` clients, so that month's total is `by` higher. */
export const januaryRaisedBy = (by: number): ClientsBody => {
  let done = false;
  return reshaped((value, channel, month) => {
    if (done || channel !== 'New paid' || month !== 11) return value;
    done = true;
    return value + by;
  });
};
