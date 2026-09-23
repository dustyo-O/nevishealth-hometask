// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR5 "Reaching the chart from the keyboard" and FR6 "What a screen reader reports", in a real
// browser on the shipped data — plus tech review F1, the regression that made the tint ours:
// a pointer resting on June while Tab arrives must not leave any part of the chart on June.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  CHART_NAME,
  expectNothingRead,
  expectReading,
  expectTintOver,
  FEBRUARY_PANEL,
  FEBRUARY_SAID,
  expectBarsShow,
  figuresOf,
  hoverMonth,
  openChart,
  readDrawing,
  readPanel,
  type Chart,
} from './support/chart';
import { MONTH_HEADINGS, press, rowOf, shippedClients } from './support/table';

/** Tab from the page heading, as a keyboard user reading down the page would. */
const tabToChart = async (page: Page, chart: Chart): Promise<void> => {
  await chart.ui.heading.click();
  await page.keyboard.press('Tab');
  await expect(chart.group).toBeFocused();
};

/**
 * Records every text the live region takes from now on, one entry per change, so "announced
 * once" can be counted rather than inferred from the final text.
 */
const recordAnnouncements = (chart: Chart) =>
  chart.live.evaluate((region) => {
    const said: string[] = [];
    (window as Window & { __said?: string[] }).__said = said;
    new MutationObserver(() => said.push(region.textContent ?? '')).observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });

const announcements = (page: Page) =>
  page.evaluate(() => (window as Window & { __said?: string[] }).__said ?? []);

test(
  'FR5-AC1: Tab from the heading puts the outline on the chart as a whole — one stop, never a bar',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    // Nothing inside the drawing can take the outline, whatever the library renders.
    const stops = await chart.drawing.evaluate(
      (drawing) =>
        [...drawing.querySelectorAll<HTMLElement | SVGElement>('*')].filter(
          (el) => el.tabIndex >= 0 && el.getAttribute('tabindex') !== null,
        ).length,
    );
    expect(stops).toBe(0);
    // The ring is visible on the group itself.
    const outline = await chart.group.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  },
);

test(
  'FR5-AC2 / FR6-AC1: arriving reads February — its column tinted, its panel shown, and "Feb 2024" with every part and the total announced',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await expectReading(chart, '2024-02');
    await expectTintOver(chart, 0);
    expect(await readPanel(chart)).toEqual(FEBRUARY_PANEL);
    await expect(chart.live).toHaveText(FEBRUARY_SAID);
  },
);

test(
  'Tech review F1: pointer resting on June, then Tab — the tint, the panel and the live region all say February',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    // The sequential-focus start goes on the heading first; the pointer then rests on June.
    await chart.ui.heading.click();
    await hoverMonth(chart, 4);
    await expectReading(chart, '2024-06');
    await expectTintOver(chart, 4);

    await page.keyboard.press('Tab');
    await expect(chart.group).toBeFocused();

    await expectReading(chart, '2024-02');
    await expectTintOver(chart, 0);
    expect(await readPanel(chart)).toEqual(FEBRUARY_PANEL);
    await expect(chart.live).toHaveText(FEBRUARY_SAID);
  },
);

test(
  'FR5-AC3: from February, Right reads March and its panel replaces February’s',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const months = figuresOf(shippedClients());
    await tabToChart(page, chart);
    await page.keyboard.press('ArrowRight');
    await expectReading(chart, '2024-03');
    await expectTintOver(chart, 1);
    expect((await readPanel(chart)).month).toBe('Mar 2024');
    await expect(chart.live).toHaveText(new RegExp(`^Mar 2024: .*total ${months[1]!.total}$`));
  },
);

test(
  'FR5: Right walks the whole year a month at a time, the panel and the announcement following',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    const months = figuresOf(shippedClients());
    await expectBarsShow(chart, months);
    await tabToChart(page, chart);
    for (const [index, heading] of MONTH_HEADINGS.entries()) {
      if (index > 0) await page.keyboard.press('ArrowRight');
      expect((await readPanel(chart)).month).toBe(heading);
      await expectTintOver(chart, index);
      const figures = months[index]!;
      await expect(chart.live).toHaveText(
        `${heading}: existing clients ${figures['Existing clients']}, new organic ${figures['New organic']}, new paid ${figures['New paid']}, total ${figures.total}`,
      );
    }
  },
);

test(
  'FR5-AC4: at January 2025, Right leaves January 2025 the month being read',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await press(page, ...Array.from({ length: 15 }, () => 'ArrowRight'));
    await expectReading(chart, '2025-01');
    await expect(chart.live).toHaveText(/^Jan 2025: /);
  },
);

test(
  'FR5-AC5: at February 2024, Left leaves February 2024 the month being read',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await press(page, 'ArrowLeft', 'ArrowLeft');
    await expectReading(chart, '2024-02');
    await expect(chart.live).toHaveText(FEBRUARY_SAID);
  },
);

test(
  'FR5-AC6: Escape hides the panel and the tint and keeps the outline; the next move opens it again',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await press(page, 'ArrowRight', 'ArrowRight');
    await page.keyboard.press('Escape');
    await expectNothingRead(chart);
    await expect(chart.group).toBeFocused();
    await expect(chart.live).toHaveText('');
    // Escape keeps the month: Right goes on from April, not from February.
    await page.keyboard.press('ArrowRight');
    await expectReading(chart, '2024-05');
  },
);

test(
  'FR5-AC6 at the end: Escape at January, then Right, reads January again',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await press(page, ...Array.from({ length: 11 }, () => 'ArrowRight'), 'Escape');
    await expectNothingRead(chart);
    await page.keyboard.press('ArrowRight');
    await expectReading(chart, '2025-01');
  },
);

test(
  'FR5-AC7 / FR4-AC8: leaving from June clears the chart, and coming back reads February again',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await press(page, 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight');
    await expectReading(chart, '2024-06');

    await page.keyboard.press('Tab');
    await expect(chart.group).not.toBeFocused();
    await expectNothingRead(chart);
    await expect(chart.live).toHaveText('');

    await page.keyboard.press('Shift+Tab');
    await expect(chart.group).toBeFocused();
    await expectReading(chart, '2024-02');
    await expect(chart.live).toHaveText(FEBRUARY_SAID);
  },
);

test(
  'FR5-AC8: Tab from the chart leaves it, and the table beneath is the next stop',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await page.keyboard.press('Tab');
    await expect(rowOf(chart.ui, 'Company')).toBeFocused();
  },
);

test(
  'FR5: keys the chart does not own do nothing to the month being read',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await press(page, 'ArrowUp', 'ArrowDown', 'Enter', 'Space', 'a');
    await expectReading(chart, '2024-02');
    await expect(chart.group).toBeFocused();
  },
);

test(
  'FR6-AC2: the chart’s figures are also a table of twelve rows, one per month, with each part and the total',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    // The figures the served data implies; the drawing shows them, totals exactly, parts on the curve (FR4).
    const months = figuresOf(shippedClients());
    await expectBarsShow(chart, months);
    await expect(chart.table.getByRole('columnheader')).toHaveText([
      'Month',
      'Existing clients',
      'New organic',
      'New paid',
      'Total',
    ]);
    const body = chart.table.locator('tbody').getByRole('row');
    await expect(body).toHaveCount(12);
    for (const [i, heading] of MONTH_HEADINGS.entries()) {
      const row = body.nth(i);
      await expect(row.getByRole('rowheader')).toHaveText(heading);
      const m = months[i]!;
      await expect(row.getByRole('cell')).toHaveText([
        String(m['Existing clients']),
        String(m['New organic']),
        String(m['New paid']),
        String(m.total),
      ]);
    }
    // Not shown on screen, and not hidden from assistive technology either.
    // The table's own box is full size; what hides it is its wrapper, a clipped 1 px square.
    const where = await chart.table.evaluate((table) => {
      const wrapper = table.parentElement!;
      const { width, height } = wrapper.getBoundingClientRect();
      const { overflow, clip } = getComputedStyle(wrapper);
      return {
        area: width * height,
        clipped: overflow === 'hidden' && clip === 'rect(0px, 0px, 0px, 0px)',
        ariaHidden: table.closest('[aria-hidden="true"]') !== null,
      };
    });
    expect(where).toEqual({ area: 1, clipped: true, ariaHidden: false });
  },
);

test(
  'FR6-AC3: each move is announced once, not repeated — and a key that moves nothing announces nothing',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await tabToChart(page, chart);
    await expect(chart.live).toHaveText(FEBRUARY_SAID);
    await recordAnnouncements(chart);

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(chart.live).toHaveText(/^Mar 2024: /);
    // Let any echo arrive before counting.
    await page.waitForTimeout(300);
    const said = (await announcements(page)).filter((text) => text !== '');
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^Mar 2024: /);
  },
);

test(
  'FR6-AC4 / AC5: the chart is named for what it shows, and its drawing gives a screen reader no loose numbers or month labels',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page);
    await expect(chart.group).toHaveAccessibleName(CHART_NAME);
    await expect(chart.group).toHaveAttribute('aria-roledescription', 'chart');
    // The group is a leaf to assistive technology: nothing of the drawing is exposed.
    expect(await chart.group.ariaSnapshot()).toBe(`- group "${CHART_NAME}"`);

    // Across the whole card, the axis labels exist only as the table's cells, never loose.
    const drawn = await readDrawing(chart);
    const snapshot = await chart.ui.chartCard.ariaSnapshot();
    const loose = snapshot
      .split('\n')
      .filter((line) => /^\s*- text:/.test(line))
      .map((line) => line.replace(/^\s*- text:\s*/, '').trim());
    for (const tick of [...drawn.yTicks, ...drawn.xTicks]) {
      expect(loose).not.toContain(tick.text);
    }
  },
);

test(
  'FR5/FR6: axe finds nothing in the chart card, at rest and while a month is read',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await openChart(page, { body: shippedClients() });
    const audit = () => new AxeBuilder({ page }).include('[aria-label="Clients chart"]').analyze();
    expect((await audit()).violations).toEqual([]);
    await tabToChart(page, chart);
    await press(page, 'ArrowRight', 'ArrowRight');
    expect((await audit()).violations).toEqual([]);
    // Axe audits the drawing too: its bars are still there, just hidden.
    expect((await readDrawing(chart)).bars).toHaveLength(12);
  },
);
