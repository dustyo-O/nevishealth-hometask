// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR6 "Narrow screens": the months scroll sideways inside the table while the name column stays
// put, with a shadow along its edge only while scrolled; the page never scrolls sideways.
// Browser-only (jsdom has no layout). D-17: the months' width was re-measured, so this asserts
// *that* the table scrolls, never by how much.
//
// Run in Chromium by the gate, and in WebKit on demand (D-15): `E2E_WEBKIT=1`.
import { expect, test, type Locator } from '@playwright/test';
import type { ClientsPage } from './support/clients-page';
import { scrollWidthOf, VIEWPORT } from './support/clients-page';
import {
  expandAll,
  figureOf,
  nameOf,
  openTable,
  pageScroll,
  rectOf,
  textRectOf,
  scrollerOf,
} from './support/table';

/** The shadow token's colour (`--shadow-sticky-edge`, tokens.css) as the browser computes it. */
const SHADOW_COLOUR = 'rgba(20, 20, 19, 0.24)';

const shadowOf = (cell: Locator) => cell.evaluate((el) => getComputedStyle(el).boxShadow);

const scrollMonths = (ui: ClientsPage, left: number) =>
  scrollerOf(ui).evaluate(async (el, to) => {
    el.scrollLeft = to;
    // The scroll event (which sets the shadow flag) is dispatched on the next frame.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, left);

const monthHeading = (ui: ClientsPage, name: string) =>
  ui.table.getByRole('columnheader', { name, exact: true });

test.describe('at 375 px', () => {
  test.use({ viewport: VIEWPORT.phone });

  test(
    'FR6-AC1: the name column and the first months are visible and the page has no horizontal scrollbar',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);

      await expect(nameOf(ui, 'Company')).toBeInViewport({ ratio: 1 });
      // "The first months are visible": at least Feb 2024 reads whole, beside the name column.
      const [feb, name, band] = await Promise.all([
        textRectOf(monthHeading(ui, 'Feb 2024')),
        rectOf(nameOf(ui, 'Company')),
        rectOf(scrollerOf(ui)),
      ]);
      expect
        .soft(feb.left, 'Feb 2024 starts right of the name column')
        .toBeGreaterThanOrEqual(name.right);
      expect
        .soft(feb.right, 'Feb 2024 reads whole inside the table')
        .toBeLessThanOrEqual(band.right);
      await expect(monthHeading(ui, 'Jan 2025')).not.toBeInViewport();
      expect(await scrollWidthOf(page)).toBe(VIEWPORT.phone.width);

      // The overflow lives in the table's own scroller, never the card or the page (D-1).
      const port = await scrollerOf(ui).evaluate((el) => ({
        scrolls: el.scrollWidth > el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      }));
      expect(port).toEqual({ scrolls: true, overflowX: 'auto' });
    },
  );

  test(
    'FR6-AC2: scrolling sideways moves the months, holds the name column, and shows a shadow on its edge',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      const names = [
        nameOf(ui, 'Company'),
        nameOf(ui, 'Branch 3'),
        ui.table.locator('thead th').first(),
      ];
      const before = await Promise.all(names.map(rectOf));
      const june = await rectOf(figureOf(ui, 'Branch 1', 'Jun 2024'));

      await scrollMonths(ui, 200);

      const after = await Promise.all(names.map(rectOf));
      for (const [i, box] of after.entries()) expect(box.left).toBeCloseTo(before[i]!.left, 0);
      expect((await rectOf(figureOf(ui, 'Branch 1', 'Jun 2024'))).left).toBeCloseTo(
        june.left - 200,
        0,
      );
      for (const name of names) expect(await shadowOf(name)).toContain(SHADOW_COLOUR);

      // Held *over* the months, not under them: the point at the name cell's middle is the name.
      const covered = await nameOf(ui, 'Branch 1').evaluate((th) => {
        const { left, width, top, height } = th.getBoundingClientRect();
        const hit = document.elementFromPoint(left + width - 4, top + height / 2);
        return th.contains(hit);
      });
      expect(covered).toBe(true);
      expect(await scrollWidthOf(page)).toBe(VIEWPORT.phone.width);
    },
  );

  test(
    'FR6-AC3: scrolled back to the start, no shadow is shown',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      const name = nameOf(ui, 'Company');
      // Negative first: before any scrolling there is none either.
      expect(await shadowOf(name)).not.toContain(SHADOW_COLOUR);

      await scrollMonths(ui, 300);
      expect(await shadowOf(name)).toContain(SHADOW_COLOUR);
      await scrollMonths(ui, 0);

      expect(await shadowOf(name)).not.toContain(SHADOW_COLOUR);
    },
  );

  test(
    'FR6-AC5: opening rows until the table outgrows the screen scrolls the page down, never sideways',
    { tag: '@regression' },
    async ({ page }) => {
      // Opening every row, level by level, is some forty clicks — slow in WebKit.
      test.slow();
      const ui = await openTable(page);

      await expandAll(ui);

      const scroll = await pageScroll(page);
      expect(scroll.height).toBeGreaterThan(scroll.innerHeight);
      expect(scroll.width).toBe(VIEWPORT.phone.width);
      // The table never scrolls up and down inside its own box: the card grows instead.
      const port = await scrollerOf(ui).evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(port).toBe(0);

      await page.mouse.wheel(0, 2000);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      await expect(ui.table.locator('tbody tr').last()).toBeInViewport();
    },
  );
});

test.describe('at 1440 px', () => {
  test.use({ viewport: VIEWPORT.desktop });

  test(
    'FR6-AC4: all twelve months and the names visible at once, nothing scrolls sideways, no shadow',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);

      for (const heading of await ui.table.getByRole('columnheader').all()) {
        await expect(heading).toBeInViewport({ ratio: 1 });
      }
      await expect(nameOf(ui, 'Company')).toBeInViewport({ ratio: 1 });
      const port = await scrollerOf(ui).evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(port).toBeLessThanOrEqual(0);

      // Negative: asked to scroll, it cannot — and so shows no shadow.
      await scrollMonths(ui, 400);
      expect(await scrollerOf(ui).evaluate((el) => el.scrollLeft)).toBe(0);
      expect(await shadowOf(nameOf(ui, 'Company'))).not.toContain(SHADOW_COLOUR);
      expect(await scrollWidthOf(page)).toBe(VIEWPORT.desktop.width);
    },
  );
});
