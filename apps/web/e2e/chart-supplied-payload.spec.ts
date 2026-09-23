// @layer: e2e
// @spec: 004-supplied-payload-non-uniform-nesting
//
// Spec 004 FR3–FR5 on the company exactly as supplied: the chart is company-wide and stacked by
// the three ways a client arrives, Existing clients being the Company row less the newly acquired.
//
// THE AGREEMENT TEST (tasks.md slice 7): for each of the twelve months the chart's three figures
// sum to the Company row's. It reads the figures from the month panel and the hidden table, which
// are exact, and never from pixels, which carry FR4's stretch. The drawing is checked separately,
// and only for what FR4 promises of it.
import { expect, test } from '@playwright/test';
import {
  CHANNELS,
  CHART_NAME,
  columnPoint,
  hoverMonth,
  openChart,
  readBars,
  readDrawing,
  readPanel,
  readTable,
  type Chart,
  type MonthFigures,
  type Segment,
} from './support/chart';
import { MONTHS, type Item } from './support/clients-double';
import { figureOf, MONTH_HEADINGS, shippedClients, type ClientsBody } from './support/table';

const FEB = 0;
const JUL = 5;

/** The Company row of the table, as its cells read. */
const companyRow = async (chart: Chart): Promise<number[]> => {
  const figures: number[] = [];
  for (const month of MONTH_HEADINGS) {
    figures.push(Number(await figureOf(chart.ui, 'Company', month).innerText()));
  }
  return figures;
};

/** Every node called `name` in the served tree, summed month by month — what the data records. */
const recorded = (node: Item, name: string): number[] => {
  if (node.name === name) return [...node.values];
  const children = [...(node.branches ?? []), ...(node.employees ?? []), ...(node.channels ?? [])];
  return node.values.map((_, m) =>
    children.reduce((sum, child) => sum + recorded(child, name)[m]!, 0),
  );
};

/** The month's panel, read by resting the pointer on its column. */
const panelFor = async (chart: Chart, index: number) => {
  await hoverMonth(chart, index);
  // The panel carries its month as the wire's ISO month; its text reads it as a person does.
  await expect(chart.panel).toHaveAttribute('data-month', MONTHS[index]!);
  return readPanel(chart);
};

/** The segments of each bar, bottom-up, by where they are painted. */
const bottomUp = (bar: Segment[]): Segment[] => [...bar].sort((a, b) => b.y - a.y);

/** The shipped company with every "New organic" channel taken out: the payload records none. */
const withoutOrganic = (): ClientsBody => {
  const body = shippedClients();
  const strip = (node: Item): void => {
    if (node.channels) node.channels = node.channels.filter(({ name }) => name !== 'New organic');
    [...(node.branches ?? []), ...(node.employees ?? [])].forEach(strip);
  };
  strip(body.company);
  return body;
};

test.describe('FR3 — the chart, its months and its three parts', () => {
  test(
    'AC1: twelve bars labelled Feb 2024 to Jan 2025, each stacking the parts it has — Existing, New organic, New paid — bottom up, and omitting any empty part',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const drawn = await readDrawing(chart);
      const months = await readTable(chart);

      expect(drawn.xTicks.map(({ text }) => text)).toEqual([...MONTH_HEADINGS]);
      expect(drawn.bars).toHaveLength(12);
      drawn.bars.forEach((bar, i) => {
        const present = CHANNELS.filter((part) => months[i]![part] > 0);
        expect(
          bottomUp(bar).map(({ name }) => name),
          MONTH_HEADINGS[i],
        ).toEqual(present);
      });
    },
  );

  test(
    'AC2 (the agreement test): in every month the three figures in the panel and in the hidden table add up to the Company row',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const company = await companyRow(chart);
      const hidden = await readTable(chart);
      expect(company).toEqual(shippedClients().company.values);
      expect(hidden).toHaveLength(12);

      for (const [i, month] of MONTH_HEADINGS.entries()) {
        const panel = await panelFor(chart, i);
        expect(panel.month).toBe(month);
        const parts = Object.fromEntries(panel.rows) as Record<string, number>;
        expect(
          panel.rows.map(([name]) => name),
          month,
        ).toEqual([...CHANNELS, 'Total']);

        const sum = CHANNELS.reduce((total, part) => total + parts[part]!, 0);
        expect(sum, `${month}: the panel's three parts make its total`).toBe(parts.Total);
        expect(parts.Total, `${month}: the panel's total is the Company row`).toBe(company[i]);

        const row = hidden[i]!;
        const rowSum = CHANNELS.reduce((total, part) => total + row[part], 0);
        expect(rowSum, `${month}: the hidden table's parts are the Company row`).toBe(company[i]);
        expect(row.total, `${month}: the hidden table's total`).toBe(company[i]);
        // One set of figures, wherever it is read.
        for (const part of CHANNELS) expect(row[part], `${month}: ${part}`).toBe(parts[part]);
      }
    },
  );

  test(
    'AC3: February 2024 is 250 existing clients, 0 new organic and 0 new paid',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);

      expect((await readTable(chart))[FEB]).toEqual({
        'Existing clients': 250,
        'New organic': 0,
        'New paid': 0,
        total: 250,
      });
    },
  );

  test(
    'AC4: July 2024 is 331 existing clients, 2 new organic and 1 new paid — 334',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);

      expect((await readTable(chart))[JUL]).toEqual({
        'Existing clients': 331,
        'New organic': 2,
        'New paid': 1,
        total: 334,
      });
    },
  );

  test(
    'AC5: every month’s new organic and new paid are the figures the business records, unchanged',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const { company } = shippedClients();
      const months = await readTable(chart);

      expect(months.map((m) => m['New organic'])).toEqual(recorded(company, 'New organic'));
      expect(months.map((m) => m['New paid'])).toEqual(recorded(company, 'New paid'));
      // And not the recorded Existing clients: that is one adviser's, not the company's.
      expect(months.map((m) => m['Existing clients'])).not.toEqual(
        recorded(company, 'Existing clients'),
      );
    },
  );

  test(
    'AC6: the legend names exactly three parts — even for a payload that records no new organic clients at all',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page, { body: withoutOrganic() });

      await expect(chart.legend.getByRole('listitem')).toHaveText([...CHANNELS]);
      // Nothing recorded is zero, and a zero part is not drawn.
      const drawn = await readDrawing(chart);
      expect(drawn.bars.flat().filter(({ name }) => name === 'New organic')).toEqual([]);
      expect((await readTable(chart)).every((m) => m['New organic'] === 0)).toBe(true);
    },
  );
});

test.describe('FR4 — small parts stay visible', () => {
  /** Every new part drawn, with its figure: the pixels a person sees against the clients it holds. */
  const newParts = async (chart: Chart) => {
    const drawn = await readDrawing(chart);
    const months = await readTable(chart);
    return drawn.bars.flatMap((bar, i) =>
      bar
        .filter(({ name }) => name === 'New organic' || name === 'New paid')
        .map((segment) => ({
          month: MONTH_HEADINGS[i]!,
          clients: months[i]![segment.name as 'New organic' | 'New paid'],
          px: segment.height,
        })),
    );
  };

  test(
    'AC1–AC2: a one-client part is about four pixels, and a two-client part is visibly taller, at about six',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const parts = await newParts(chart);
      const ones = parts.filter(({ clients }) => clients === 1);
      const twos = parts.filter(({ clients }) => clients === 2);
      expect(ones.length).toBeGreaterThan(0);
      expect(twos.length).toBeGreaterThan(0);

      for (const { month, px } of ones) expect(px, `${month}: one client`).toBeCloseTo(4, 1);
      for (const { month, px } of twos) expect(px, `${month}: two clients`).toBeCloseTo(6.34, 1);
      // Visibly: the shortest two is well clear of the tallest one — not the flat floor's tie.
      const tallestOne = Math.max(...ones.map(({ px }) => px));
      expect(Math.min(...twos.map(({ px }) => px)) - tallestOne).toBeGreaterThan(2);
    },
  );

  test(
    'AC3: in July both new parts are visible and neither covers the other',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const july = bottomUp((await readDrawing(chart)).bars[JUL]!);
      const [existing, organic, paid] = july;

      expect(july.map(({ name }) => name)).toEqual([...CHANNELS]);
      for (const part of [organic!, paid!]) expect(part.height).toBeGreaterThanOrEqual(3.95);
      // Each begins where the one beneath it ends: nothing painted over anything.
      expect(Math.abs(existing!.y - (organic!.y + organic!.height))).toBeLessThan(0.1);
      expect(Math.abs(organic!.y - (paid!.y + paid!.height))).toBeLessThan(0.1);
    },
  );

  test(
    'AC4: every bar reaches the Company row’s figure exactly, stretched or not',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const company = await companyRow(chart);
      const { bars } = await readBars(chart);

      bars.forEach((bar, i) => {
        expect(Math.abs(bar.reach - company[i]!), MONTH_HEADINGS[i]).toBeLessThan(0.05);
      });
    },
  );

  test(
    'AC5: February, with nobody newly acquired, draws no new-client part at all — only Existing, exactly to scale',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const { bars } = await readBars(chart);
      const february = (await readDrawing(chart)).bars[FEB]!;

      expect(february.map(({ name }) => name)).toEqual(['Existing clients']);
      expect(Math.abs(bars[FEB]!['Existing clients'] - 250)).toBeLessThan(0.05);
    },
  );

  test(
    'AC6: the figures read are exact — the drawing borrows from Existing, the panel and the hidden table do not',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const { bars } = await readBars(chart);
      const july = (await readTable(chart))[JUL]!;
      const panel = await panelFor(chart, JUL);

      // Drawn, July's Existing gave up what its new parts gained…
      expect(bars[JUL]!['Existing clients']).toBeLessThan(331 - 0.5);
      // …read, it did not.
      expect(july['Existing clients']).toBe(331);
      expect(panel.rows).toEqual([
        ['Existing clients', 331],
        ['New organic', 2],
        ['New paid', 1],
        ['Total', 334],
      ]);
    },
  );
});

test.describe('FR5 — the legend, the panel and what a screen reader reads', () => {
  test(
    'AC1: the legend names Existing clients, New organic and New paid, each with its swatch',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const items = chart.legend.getByRole('listitem');

      await expect(items).toHaveText([...CHANNELS]);
      const swatches = await chart.legend.evaluate((list) =>
        [...list.querySelectorAll('li > span')].map((swatch) => {
          const { width, height } = swatch.getBoundingClientRect();
          return { width, height, colour: getComputedStyle(swatch).backgroundColor };
        }),
      );
      expect(swatches).toHaveLength(3);
      for (const swatch of swatches) {
        expect(swatch.width).toBeGreaterThan(0);
        expect(swatch.height).toBeGreaterThan(0);
      }
      expect(new Set(swatches.map(({ colour }) => colour)).size).toBe(3);
    },
  );

  test(
    'AC2: pointing at July 2024 opens a panel reading "Jul 2024", 331, 2, 1 and a total of 334',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);

      expect(await panelFor(chart, JUL)).toEqual({
        month: 'Jul 2024',
        rows: [
          ['Existing clients', 331],
          ['New organic', 2],
          ['New paid', 1],
          ['Total', 334],
        ],
      });
    },
  );

  test(
    'AC2 (negative): pointing above every bar, or off the chart, opens no panel',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      await hoverMonth(chart, JUL);
      await expect(chart.panel).toHaveCount(1);

      await page.mouse.move(0, 0);
      await expect(chart.panel).toHaveCount(0);
      const { x } = await columnPoint(chart, JUL, 'top');
      const svg = await chart.svg.boundingBox();
      await page.mouse.move(x, svg!.y + svg!.height + 40);
      await expect(chart.panel).toHaveCount(0);
    },
  );

  test(
    'AC3: a screen reader reads the figures as a table of twelve rows — existing clients, new organic, new paid and the total',
    { tag: '@regression' },
    async ({ page }) => {
      const chart = await openChart(page);
      const table = page.getByRole('table', { name: CHART_NAME });

      await expect(table.getByRole('columnheader')).toHaveText([
        'Month',
        'Existing clients',
        'New organic',
        'New paid',
        'Total',
      ]);
      await expect(table.locator('tbody').getByRole('row')).toHaveCount(12);
      await expect(table.locator('tbody').getByRole('rowheader')).toHaveText([...MONTH_HEADINGS]);
      const months: MonthFigures[] = await readTable(chart);
      for (const month of months) expect(Object.values(month).every(Number.isInteger)).toBe(true);
    },
  );

  test(
    'AC4: for every month the panel’s three figures make its total, and that total is the Company row',
    { tag: '@regression' },
    async ({ page }) => {
      // Covered month by month in FR3-AC2 (the agreement test); here on figures that are not the
      // shipped ones, so the panel cannot pass by holding a copy of the year.
      const body = shippedClients();
      const anna = body.company.branches![0]!.employees![0]!;
      const paid = anna.channels!.find(({ name }) => name === 'New paid')!;
      paid.values = paid.values.map((value, m) => value + (m % 3));
      body.company.values = body.company.values.map((value, m) => value + (m % 3));
      const chart = await openChart(page, { body });
      const company = await companyRow(chart);
      expect(company).toEqual(body.company.values);

      for (const i of [FEB, 2, JUL, 11]) {
        const parts = Object.fromEntries((await panelFor(chart, i)).rows) as Record<string, number>;
        const sum = CHANNELS.reduce((total, part) => total + parts[part]!, 0);
        expect(sum, MONTH_HEADINGS[i]).toBe(parts.Total);
        expect(parts.Total, MONTH_HEADINGS[i]).toBe(company[i]);
        expect(parts['New paid'], MONTH_HEADINGS[i]).toBe(paid.values[i]);
      }
    },
  );
});
