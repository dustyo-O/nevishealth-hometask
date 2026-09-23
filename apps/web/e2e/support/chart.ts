import { expect, type Locator, type Page } from '@playwright/test';
import type { Item } from './clients-double';
import { clientsPage, type ClientsPage } from './clients-page';
import { MONTH_HEADINGS, openTable, shippedClients, type ClientsBody } from './table';

/**
 * Spec 003's browser suite reads the chart the way a person does — from what is drawn — and never
 * from the widget's state. Bars are read as pixels against the axis the drawing labels, so a
 * figure "on the chart" means a height a sighted user could measure, not a number in the DOM.
 */

/**
 * The three parts of every bar, bottom-up (FR1-AC5): Existing clients is the Company row less the
 * newly acquired, which the data records as New organic and New paid (004 §2.3).
 */
export const CHANNELS = ['Existing clients', 'New organic', 'New paid'] as const;
export type Part = (typeof CHANNELS)[number];

/** February 2024 on the supplied data: nobody newly acquired, all 250 existing (004 FR3-AC3). */
export const FEBRUARY = {
  'Existing clients': 250,
  'New organic': 0,
  'New paid': 0,
  total: 250,
};

/** The live region's sentence for February (FR6-AC1), exactly as `describeMonth` words it. */
export const FEBRUARY_SAID = 'Feb 2024: existing clients 250, new organic 0, new paid 0, total 250';

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
  // Twelve bars standing: the figures have been drawn. Counted by column, never by segment — a
  // part that is zero that month draws no rectangle at all (004 §2.7).
  await expect.poll(async () => (await readDrawing(chart)).bars.length).toBe(12);
  return chart;
};

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
    // Centres within a pixel are one column: rounding each to a whole pixel split a column in
    // two when its layers landed either side of a half (measured on the 0–500 scale, 004 s2).
    const centre = (segment: { x: number; width: number }) => segment.x + segment.width / 2;
    const bars: (typeof byLayer)[number][] = [];
    for (const segment of byLayer.flat().sort((a, b) => centre(a) - centre(b))) {
      const column = bars.at(-1);
      if (column !== undefined && centre(segment) - centre(column[0]!) < 1) column.push(segment);
      else bars.push([segment]);
    }

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

export type MonthFigures = Record<Part, number> & { total: number };

/**
 * The least a part with clients in it is drawn, in pixels (004 FR4, §2.4). The newly acquired are
 * 0–2 clients a month — about a pixel and a half to scale — so the chart lifts them to this, and
 * takes what it adds **from Existing clients in the same bar**.
 *
 * WHAT IS EXACT AND WHAT GIVES WAY: a bar's total is drawn exactly to its figure — `reach` is
 * checked to within PRECISION, as spec 003's suite checked it before slice 3 widened it; do not
 * widen it again. Only the parts give way: a new part is at least FLOOR_PX and never more than the
 * floor above its figure, and Existing clients is short by what the others borrowed. Checking the
 * parts "exactly to scale" fails every month with a new client in it, because FR4 asks the drawing
 * to differ there. The figures a person reads — the panel, the hidden table, the announcement —
 * are still asserted exactly, and a month with nobody new is drawn to its figures to PRECISION.
 */
export const FLOOR_PX = 4;

/** How close a drawn edge must be to where the figures put it, in clients: a hundredth-ish. */
const PRECISION = 0.05;

/** A bar as drawn, in clients and unrounded: each part's height, and how high the bar reaches. */
export type BarReading = Record<Part, number> & { reach: number };

/**
 * Every bar's parts as numbers of clients, read as a person reads a chart: each segment's height
 * against the distance between the "0" and the top gridline and what the top label says. Not
 * rounded: with the floor (FLOOR_PX) a reading is not a whole number of clients, so a rounded one
 * would be a figure the chart never showed. Compare it to figures with `expectBarShows`.
 */
export const readBars = async (
  chart: Chart,
): Promise<{ bars: BarReading[]; perClient: number }> => {
  const drawn = await readDrawing(chart);
  const top = Math.max(...drawn.yTicks.map(({ text }) => Number(text)));
  const ceiling = Math.min(...drawn.gridlines);
  const floor = Math.max(...drawn.gridlines);
  const perClient = (floor - ceiling) / top;
  const bars = drawn.bars.map((segments) => {
    const bar = {
      reach: (floor - Math.min(...segments.map(({ y }) => y))) / perClient,
    } as BarReading;
    for (const part of CHANNELS) {
      // A part missing from the drawing is a part that is zero that month.
      const segment = segments.find(({ name }) => name === part);
      bar[part] = segment === undefined ? 0 : segment.height / perClient;
    }
    return bar;
  });
  return { bars, perClient };
};

/**
 * The bar shows these figures: its total exactly (FR4-AC2); a zero part not drawn at all; a new
 * part with clients in it at least FLOOR_PX and no more than the floor above its figure; Existing
 * clients short by no more than the two new parts borrowed (FR4-AC1). A month with no newly
 * acquired clients borrows nothing, so its every part is exact.
 */
export const expectBarShows = (
  bar: BarReading,
  figures: MonthFigures,
  perClient: number,
  month: string,
): void => {
  const floor = FLOOR_PX / perClient;
  expect(Math.abs(bar.reach - figures.total), `${month}: the bar reaches its total`).toBeLessThan(
    PRECISION,
  );
  const lifted = figures['New organic'] > 0 || figures['New paid'] > 0;
  for (const part of CHANNELS) {
    const figure = figures[part];
    const drawn = `${month}: ${part} drawn as ${figure}`;
    if (figure === 0) expect(bar[part], drawn).toBeLessThan(PRECISION);
    else if (!lifted) expect(Math.abs(bar[part] - figure), drawn).toBeLessThan(PRECISION);
    else if (part === 'Existing clients') {
      expect(bar[part], drawn).toBeLessThan(figure + PRECISION);
      expect(bar[part], drawn).toBeGreaterThan(figure - 2 * floor - PRECISION);
    } else {
      expect(bar[part], drawn).toBeGreaterThan(Math.max(figure, floor) - PRECISION);
      expect(bar[part], drawn).toBeLessThan(figure + floor + PRECISION);
    }
  }
};

/** Every bar shows its month's figures (`expectBarShows`), twelve of each. */
export const expectBarsShow = async (chart: Chart, figures: MonthFigures[]): Promise<void> => {
  const { bars, perClient } = await readBars(chart);
  expect(bars).toHaveLength(figures.length);
  bars.forEach((bar, i) => expectBarShows(bar, figures[i]!, perClient, MONTH_HEADINGS[i]!));
};

/** Every channel named `name` in the tree, month by month: what the data records. */
const recorded = (node: Item, name: string): number[] =>
  node.name === name
    ? node.values
    : [...(node.branches ?? []), ...(node.employees ?? []), ...(node.channels ?? [])]
        .map((child) => recorded(child, name))
        .reduce(
          (sum, values) => sum.map((value, i) => value + (values[i] ?? 0)),
          node.values.map(() => 0),
        );

/**
 * What the chart must say about `body`, worked out here from the served figures and not by the
 * widget: New organic and New paid as the tree records them; Existing clients the Company row
 * less those two, never below zero (004 §2.3); the total, the three added up.
 */
export const figuresOf = (body: ClientsBody): MonthFigures[] => {
  const organic = recorded(body.company, 'New organic');
  const paid = recorded(body.company, 'New paid');
  return body.company.values.map((company, i) => {
    const figures = {
      'Existing clients': Math.max(0, company - organic[i]! - paid[i]!),
      'New organic': organic[i]!,
      'New paid': paid[i]!,
    };
    return { ...figures, total: CHANNELS.reduce((sum, part) => sum + figures[part], 0) };
  });
};

/** What the visually-hidden table says, month by month (FR6-AC2): exact figures, as text. */
export const readTable = (chart: Chart): Promise<MonthFigures[]> =>
  chart.table.evaluate(
    (table, parts) =>
      [...table.querySelectorAll('tbody tr')].map((row) => {
        const cells = [...row.querySelectorAll('td')].map((td) => Number(td.textContent));
        return Object.fromEntries([
          ...parts.map((part, i) => [part, cells[i]]),
          ['total', cells[parts.length]],
        ]) as MonthFigures;
      }),
    [...CHANNELS],
  );

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

/** The panel's reading of February on the supplied data, in stacking order. */
export const FEBRUARY_PANEL = {
  month: 'Feb 2024',
  rows: [
    ['Existing clients', 250],
    ['New organic', 0],
    ['New paid', 0],
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

/** Every channel node with the items above it, wherever it hangs in the tree. */
const channelsOf = (node: Item, above: Item[] = []): { channel: Item; above: Item[] }[] =>
  node.channels?.map((channel) => ({ channel, above: [...above, node] })) ??
  [...(node.branches ?? []), ...(node.employees ?? [])].flatMap((child) =>
    channelsOf(child, [...above, node]),
  );

/**
 * The shipped data with every channel figure changed by `change(value, channel, month)`, and every
 * stored figure above it moved by the same amount. Moved, not recomputed: the supplied figures
 * that do not add up (004 FR2) still do not, by exactly as much — the copy stays the company we
 * were given, only with different numbers, and the two cards still describe the same company.
 */
export const reshaped = (
  change: (value: number, channel: string, month: number) => number,
): ClientsBody => {
  const body = shippedClients();
  for (const { channel, above } of channelsOf(body.company)) {
    channel.values = channel.values.map((value, month) => {
      const next = change(value, channel.name, month);
      for (const item of above) item.values[month]! += next - value;
      return next;
    });
  }
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
