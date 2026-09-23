// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR3-AC17/AC18: moving the outline onto a month that is out of view. Browser-only — jsdom has
// no layout. The contract is D-7: `focus({ preventScroll })` + `scrollIntoView({ block:
// 'nearest', inline: 'nearest' })` with `scroll-padding-inline-start` equal to the name column,
// so a month moved into view lands exactly beside the sticky column, never beneath it; and the
// page moves vertically only when the row is not already fully in view, and then only as far as
// it takes to show that row — clear of the window's edge by the row's scroll margin (FR3,
// amended 2026-09-23), never flush against it.
//
// Run in Chromium by the gate, and in WebKit on demand (D-15): `E2E_WEBKIT=1`.
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { ClientsPage } from './support/clients-page';
import { VIEWPORT } from './support/clients-page';
import {
  expandAll,
  figureOf,
  MONTH_HEADINGS,
  openTable,
  press,
  rectOf,
  textRectOf,
  rowOf,
  scrollerOf,
  tabIntoTable,
  toggleByName,
} from './support/table';

test.use({ viewport: VIEWPORT.phone });

const TOLERANCE = 1;

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/**
 * The month is in view sideways: its cell starts at or right of the sticky name column's edge
 * (never beneath it — D-7's scroll padding) and its figure's digits are painted inside the
 * scroller, whole. Soft, so a failure here does not hide what the page did vertically.
 */
const expectBesideStickyColumn = async (ui: ClientsPage, row: Locator, cell: Locator) => {
  const [name, box, digits, port] = await Promise.all([
    rectOf(row.locator('th')),
    rectOf(cell),
    textRectOf(cell),
    rectOf(scrollerOf(ui)),
  ]);
  const what = `${(await cell.textContent()) ?? ''} in [${box.left}, ${box.right}]`;
  expect
    .soft(box.left, `${what} starts beside the name column`)
    .toBeGreaterThanOrEqual(name.right - TOLERANCE);
  expect
    .soft(digits.right, `${what}: its digits end inside the scroller`)
    .toBeLessThanOrEqual(port.right + TOLERANCE);
};

/** Puts the page where the row's top sits at `top` px from the top of the viewport. */
const scrollRowTo = (row: Locator, top: number) =>
  row.evaluate((tr, wanted) => {
    window.scrollBy(0, tr.getBoundingClientRect().top - wanted);
  }, top);

let ui: ClientsPage;

test.beforeEach(async ({ page }) => {
  ui = await openTable(page);
  // Tall enough for the page to scroll at 812 px. Branch 2 has no advisers (004 FR1), so the
  // height comes from Anna Blackwood's channels instead.
  await toggleByName(ui, 'Branch 1');
  await toggleByName(ui, 'Anna Blackwood');
});

test(
  'FR3-AC17: on a fully visible row, walking every month right and back scrolls sideways only',
  { tag: '@regression' },
  async ({ page }) => {
    await tabIntoTable(page, ui);
    await press(page, 'ArrowDown', 'ArrowDown');
    const row = rowOf(ui, 'Anna Blackwood');
    await expect(row).toBeFocused();
    // Mid-screen with the page scrolled, as the consult measured (scrollY 300 in slice 3).
    await scrollRowTo(row, 400);
    const y = await scrollY(page);
    expect(y).toBeGreaterThan(0);

    await page.keyboard.press('ArrowRight');
    for (const month of MONTH_HEADINGS) {
      const cell = figureOf(ui, 'Anna Blackwood', month);
      await expect(cell).toBeFocused();
      await expectBesideStickyColumn(ui, row, cell);
      expect(await scrollY(page)).toBe(y);
      if (month !== 'Jan 2025') await page.keyboard.press('ArrowRight');
    }
    // It did have to scroll sideways to get there — the months overflow at 375.
    expect(await scrollerOf(ui).evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

    // And back, where D-7's scroll padding is what keeps the months out from under the name.
    for (const month of [...MONTH_HEADINGS].reverse().slice(1)) {
      await page.keyboard.press('ArrowLeft');
      const cell = figureOf(ui, 'Anna Blackwood', month);
      await expect(cell).toBeFocused();
      await expectBesideStickyColumn(ui, row, cell);
      expect(await scrollY(page)).toBe(y);
    }
  },
);

test(
  'FR3-AC17: End and Home on a figure jump across the months and still only scroll sideways',
  { tag: '@regression' },
  async ({ page }) => {
    await tabIntoTable(page, ui);
    await press(page, 'ArrowDown');
    const row = rowOf(ui, 'Branch 1');
    await scrollRowTo(row, 300);
    const y = await scrollY(page);

    await press(page, 'ArrowRight', 'End');
    await expectBesideStickyColumn(ui, row, figureOf(ui, 'Branch 1', 'Jan 2025'));
    await page.keyboard.press('Home');
    await expectBesideStickyColumn(ui, row, figureOf(ui, 'Branch 1', 'Feb 2024'));
    expect(await scrollY(page)).toBe(y);
  },
);

// The supplied tree fully open is twelve rows (004 FR1) — too short, at 812 px, for a middle row
// to be cut off at the top: measured, the page scrolls at most 474 px and the table starts at
// 590. The same phone width on a shorter screen gives the page room to cut a row off at either
// edge; the data is not padded out to make the page taller.
test.describe('on a phone held with less height to spare', () => {
  test.use({ viewport: { ...VIEWPORT.phone, height: 480 } });

  for (const edge of ['bottom', 'top'] as const) {
    test(
      `FR3-AC18: a row cut off at the ${edge} of the screen — entering a month scrolls the page just far enough to show that row`,
      { tag: '@regression' },
      async ({ page }) => {
        // Everything open, so the page is a few screens tall and a middle row can be cut off at
        // either edge.
        await expandAll(ui);
        const rows = ui.table.locator('tbody tr');
        // The third row down, Anna Blackwood: measured at 480 px high, the page scrolls 806 px and
        // her row starts at 702, so it can sit 20 px past either edge.
        const index = 2;
        const row = rows.nth(index);
        await tabIntoTable(page, ui);
        await press(page, ...Array<string>(index).fill('ArrowDown'));
        await expect(row).toBeFocused();

        // The months scrolled to their end, so Feb 2024 is out of sight sideways as well.
        await scrollerOf(ui).evaluate((el) => {
          el.scrollLeft = el.scrollWidth;
        });
        const innerHeight = await page.evaluate(() => window.innerHeight);
        const { top, bottom } = await rectOf(row);
        const CUT = 20;
        await scrollRowTo(row, edge === 'bottom' ? innerHeight - (bottom - top) + CUT : -CUT);
        const before = await scrollY(page);
        // The row really is cut off before the key is pressed — by what the engine allowed: WebKit
        // snaps the page's scroll position to whole pixels, so the cut can be 20.75 rather than 20.
        const cutOff = await rectOf(row);
        const cut = edge === 'bottom' ? cutOff.bottom - innerHeight : -cutOff.top;
        expect(Math.abs(cut - CUT)).toBeLessThan(1);

        await page.keyboard.press('ArrowRight');
        const cell = row.getByRole('gridcell').first();
        await expect(cell).toBeFocused();

        // Vertically: just far enough to show the row clear of the edge (FR3, amended
        // 2026-09-23) — the cut plus the row's scroll margin, and not a pixel more.
        const margin = await cell.evaluate((td) =>
          parseFloat(getComputedStyle(td).scrollMarginTop),
        );
        expect(margin, 'the outline has room to rest clear of the edge').toBeGreaterThan(0);
        const after = await rectOf(row);
        const moved = (await scrollY(page)) - before;
        if (edge === 'bottom') {
          expect(Math.abs(innerHeight - after.bottom - margin)).toBeLessThanOrEqual(TOLERANCE);
          expect(Math.abs(moved - (cut + margin))).toBeLessThanOrEqual(TOLERANCE);
        } else {
          expect(Math.abs(after.top - margin)).toBeLessThanOrEqual(TOLERANCE);
          expect(Math.abs(moved + (cut + margin))).toBeLessThanOrEqual(TOLERANCE);
        }
        // Sideways: back to Feb 2024, beside the name column.
        await expectBesideStickyColumn(ui, row, cell);
      },
    );
  }
});
