// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR3 "Operating the table from the keyboard" — AC1…AC16 — with real key presses in a real
// browser on the shipped data. The arrows only move; Enter and Space are the only keys that open
// or close (the 2026-09-22 amendment). Every step also checks the roving `tabindex`: exactly one
// element in the grid is a tab stop, and it is the one with focus (D-9).
//
// Scrolling a month into view (FR3-AC17/AC18) is layout, and lives in table-keyboard-scroll.
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { ClientsPage } from './support/clients-page';
import {
  ANNA_CHANNELS,
  figureOf,
  openTable,
  press,
  rowOf,
  settled,
  tabIntoTable,
  toggleByName,
} from './support/table';

/** The outline is on `target`, and `target` is the grid's one and only tab stop. */
const expectOutlineOn = async (ui: ClientsPage, target: Locator) => {
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute('tabindex', '0');
  await expect(ui.table.locator('[tabindex="0"]')).toHaveCount(1);
};

const expanded = (ui: ClientsPage, name: string) => rowOf(ui, name).getAttribute('aria-expanded');

let ui: ClientsPage;

test.beforeEach(async ({ page }) => {
  ui = await openTable(page);
});

const enter = (page: Page) => tabIntoTable(page, ui);

test(
  'FR3-AC1: Tab from the heading lands on the Company row; Tab again leaves the table',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await expectOutlineOn(ui, rowOf(ui, 'Company'));

    await page.keyboard.press('Tab');
    const inTable = await ui.table.evaluate((table) => table.contains(document.activeElement));
    expect(inTable).toBe(false);

    // And Shift+Tab comes back to the same single stop, not to a figure or the scroller.
    await page.keyboard.press('Shift+Tab');
    await expectOutlineOn(ui, rowOf(ui, 'Company'));
  },
);

test(
  'FR3-AC2: Down then Right on a closed Branch 1 → Branch 1, then its Feb 2024 figure; it stays closed',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);

    await page.keyboard.press('ArrowDown');
    await expectOutlineOn(ui, rowOf(ui, 'Branch 1'));
    await page.keyboard.press('ArrowRight');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Feb 2024'));
    expect(await expanded(ui, 'Branch 1')).toBe('false');
  },
);

test(
  'FR3-AC3: Right on an open Branch 1 → its Feb 2024 figure; it stays open',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'Enter');
    await settled(ui);

    await page.keyboard.press('ArrowRight');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Feb 2024'));
    expect(await expanded(ui, 'Branch 1')).toBe('true');
  },
);

test(
  'FR3-AC4: Right on an acquisition channel → its Feb 2024 figure',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'Enter', 'ArrowDown', 'Enter', 'ArrowDown');
    await expectOutlineOn(ui, rowOf(ui, ANNA_CHANNELS[0]));

    await page.keyboard.press('ArrowRight');
    await expectOutlineOn(ui, figureOf(ui, ANNA_CHANNELS[0], 'Feb 2024'));
  },
);

test(
  'FR3-AC5/AC6: along a row — Right Right Left lands on Mar 2024; Left from Feb 2024 returns to the name',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'ArrowRight');

    await press(page, 'ArrowRight', 'ArrowRight', 'ArrowLeft');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Mar 2024'));

    await page.keyboard.press('ArrowLeft');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Feb 2024'));
    await page.keyboard.press('ArrowLeft');
    await expectOutlineOn(ui, rowOf(ui, 'Branch 1'));
    // Left on a row goes to its parent — never collapses or opens anything on the way.
    expect(await expanded(ui, 'Branch 1')).toBe('false');
  },
);

test(
  'FR3-AC7/AC8: from Branch 1 Jun 2024, Down keeps the month; Home and End go to Feb 2024 and Jan 2025',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'ArrowRight', ...Array<string>(4).fill('ArrowRight'));
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Jun 2024'));

    await page.keyboard.press('ArrowDown');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 2', 'Jun 2024'));
    await page.keyboard.press('ArrowUp');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Jun 2024'));

    await page.keyboard.press('Home');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Feb 2024'));
    await page.keyboard.press('End');
    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Jan 2025'));
  },
);

test(
  'FR3-AC9: Enter or Space on a figure opens nothing and the outline stays',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'ArrowRight');
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await press(page, 'Enter', 'Space');
    await settled(ui);

    await expectOutlineOn(ui, figureOf(ui, 'Branch 1', 'Feb 2024'));
    expect(await expanded(ui, 'Branch 1')).toBe('false');
    await expect(ui.table.locator('tbody tr')).toHaveCount(4);
    // Space is swallowed, not handed to the browser to scroll the page.
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  },
);

test(
  'FR3-AC10: nothing wraps — Down then Right on the last row’s Jan 2025 leave the outline there',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'End', 'ArrowRight', 'End');
    const last = figureOf(ui, 'Branch 3', 'Jan 2025');
    await expectOutlineOn(ui, last);

    await press(page, 'ArrowDown', 'ArrowRight');
    await expectOutlineOn(ui, last);
  },
);

test(
  'FR3-AC11 / nothing wraps: Left and Up on the Company row leave the outline there',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);

    await press(page, 'ArrowLeft', 'ArrowUp');
    await expectOutlineOn(ui, rowOf(ui, 'Company'));
    expect(await expanded(ui, 'Company')).toBe('true');

    // …and the same when the Company row is closed (review 2 F1).
    await page.keyboard.press('Enter');
    await settled(ui);
    await page.keyboard.press('ArrowLeft');
    await expectOutlineOn(ui, rowOf(ui, 'Company'));
    expect(await expanded(ui, 'Company')).toBe('false');
  },
);

test(
  'FR3-AC12: Left on an open Branch 1 goes to the Company row, and Branch 1 stays open',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'Enter');
    await settled(ui);

    await page.keyboard.press('ArrowLeft');
    await expectOutlineOn(ui, rowOf(ui, 'Company'));
    expect(await expanded(ui, 'Branch 1')).toBe('true');
  },
);

test(
  'FR3-AC13: Left on one of Branch 1’s advisers goes to Branch 1',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'Enter', 'ArrowDown', 'ArrowDown', 'ArrowDown');
    await expectOutlineOn(ui, rowOf(ui, 'Maria Gutierrez'));

    await page.keyboard.press('ArrowLeft');
    await expectOutlineOn(ui, rowOf(ui, 'Branch 1'));
  },
);

test(
  'FR3-AC14: Enter opens a row with children and Space closes it again',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('Enter');
    await settled(ui);
    expect(await expanded(ui, 'Branch 1')).toBe('true');
    await expect(rowOf(ui, 'Anna Blackwood')).toBeVisible();
    await expectOutlineOn(ui, rowOf(ui, 'Branch 1'));

    await page.keyboard.press('Space');
    await settled(ui);
    expect(await expanded(ui, 'Branch 1')).toBe('false');
    await expect(rowOf(ui, 'Anna Blackwood')).toHaveCount(0);
    await expectOutlineOn(ui, rowOf(ui, 'Branch 1'));
  },
);

test(
  'FR3-AC15: Enter or Space on a row with nothing beneath it opens nothing; the outline stays',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await press(page, 'ArrowDown', 'Enter', 'ArrowDown', 'Enter', 'ArrowDown');
    await settled(ui);
    const channel = rowOf(ui, ANNA_CHANNELS[0]);
    const rows = await ui.table.locator('tbody tr').count();

    await press(page, 'Enter', 'Space');
    await settled(ui);

    await expectOutlineOn(ui, channel);
    await expect(channel).not.toHaveAttribute('aria-expanded');
    await expect(ui.table.locator('tbody tr')).toHaveCount(rows);
  },
);

test(
  'FR3-AC16: Home from deep in the table → the Company row; End → the last visible row',
  { tag: '@regression' },
  async ({ page }) => {
    await toggleByName(ui, 'Branch 3');
    await enter(page);
    await press(page, 'ArrowDown', 'Enter', 'ArrowDown', 'Enter', 'ArrowDown', 'ArrowDown');
    await settled(ui);
    await expectOutlineOn(ui, rowOf(ui, ANNA_CHANNELS[1]));

    await page.keyboard.press('Home');
    await expectOutlineOn(ui, rowOf(ui, 'Company'));

    await page.keyboard.press('End');
    const lastRow = ui.table.locator('tbody tr').last();
    await expectOutlineOn(ui, lastRow);
    // Branch 3 is open, so the last visible row is its last adviser, not Branch 3 itself.
    await expect(lastRow).toHaveAttribute('aria-level', '3');
  },
);

test(
  'FR3: Up and Down skip what is hidden inside a closed row',
  { tag: '@regression' },
  async ({ page }) => {
    await toggleByName(ui, 'Branch 1');
    await toggleByName(ui, 'Branch 1');
    await enter(page);

    await press(page, 'ArrowDown', 'ArrowDown');
    await expectOutlineOn(ui, rowOf(ui, 'Branch 2'));
    await page.keyboard.press('ArrowUp');
    await expectOutlineOn(ui, rowOf(ui, 'Branch 1'));
  },
);

test(
  'FR3: the outline carries a visible ring on a row and on a figure',
  { tag: '@regression' },
  async ({ page }) => {
    await enter(page);
    await page.keyboard.press('ArrowDown');

    // D-4: the row's ring is painted as inset shadows on its cells, the name cell included.
    const nameShadow = await rowOf(ui, 'Branch 1')
      .locator('th')
      .evaluate((th) => getComputedStyle(th).boxShadow);
    expect(nameShadow).toMatch(/inset/);

    await page.keyboard.press('ArrowRight');
    const outline = await figureOf(ui, 'Branch 1', 'Feb 2024').evaluate((td) => {
      const style = getComputedStyle(td);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThan(0);
  },
);
