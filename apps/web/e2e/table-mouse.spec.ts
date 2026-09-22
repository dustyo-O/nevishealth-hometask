// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR2 "Opening and closing a row with the mouse", end to end in a real browser on the shipped
// data. Every collapse waits for the departing rows to leave the DOM (they linger ~250 ms,
// `inert` — D-8/D-15a) before counting anything. Motion itself (FR2-AC8) has its own file.
import { expect, test } from '@playwright/test';
import {
  ANNA_CHANNELS,
  BRANCH_1_ADVISERS,
  figureOf,
  nameOf,
  namesAsRead,
  openTable,
  press,
  rowOf,
  settled,
  tabIntoTable,
  toggleByName,
} from './support/table';

const CLOSED = ['Company', 'Branch 1', 'Branch 2', 'Branch 3'];

/**
 * How the arrow is turned, as the browser paints it — the individual `rotate` property and any
 * `transform` together, so the check does not care which one the stylesheet uses.
 */
const chevronTurn = (ui: Awaited<ReturnType<typeof openTable>>, name: string) =>
  nameOf(ui, name)
    .locator('svg')
    .evaluate((svg) => {
      const style = getComputedStyle(svg);
      return `${style.rotate} ${style.transform}`;
    });

test(
  "FR2-AC1: clicking Branch 1's name shows its five advisers directly beneath, one step in, and turns the arrow",
  { tag: '@regression' },
  async ({ page }) => {
    const ui = await openTable(page);
    const closedTurn = await chevronTurn(ui, 'Branch 1');

    await toggleByName(ui, 'Branch 1');

    await expect(namesAsRead(ui)).toHaveText([
      'Company',
      'Branch 1',
      ...BRANCH_1_ADVISERS,
      'Branch 2',
      'Branch 3',
    ]);
    for (const adviser of BRANCH_1_ADVISERS) {
      await expect(rowOf(ui, adviser)).toHaveAttribute('aria-level', '3');
    }
    expect(await chevronTurn(ui, 'Branch 1')).not.toBe(closedTurn);
    expect(await chevronTurn(ui, 'Branch 1')).toBe(await chevronTurn(ui, 'Company'));
  },
);

test(
  'FR2-AC2: clicking Branch 1 again hides its advisers and returns the arrow',
  { tag: '@regression' },
  async ({ page }) => {
    const ui = await openTable(page);
    const closedTurn = await chevronTurn(ui, 'Branch 1');

    await toggleByName(ui, 'Branch 1');
    await toggleByName(ui, 'Branch 1');

    await expect(ui.rowNames).toHaveText(CLOSED);
    await expect(ui.table.locator('tbody tr')).toHaveCount(4);
    expect(await chevronTurn(ui, 'Branch 1')).toBe(closedTurn);
  },
);

test(
  "FR2-AC3: closing Branch 1 hides Anna's channels too, and re-opening shows Anna closed",
  { tag: '@regression' },
  async ({ page }) => {
    const ui = await openTable(page);
    await toggleByName(ui, 'Branch 1');
    await toggleByName(ui, 'Anna Blackwood');
    await expect(rowOf(ui, ANNA_CHANNELS[0])).toBeVisible();

    await toggleByName(ui, 'Branch 1');
    await expect(ui.rowNames).toHaveText(CLOSED);

    await toggleByName(ui, 'Branch 1');
    await expect(rowOf(ui, 'Anna Blackwood')).toHaveAttribute('aria-expanded', 'false');
    for (const channel of ANNA_CHANNELS) await expect(rowOf(ui, channel)).toHaveCount(0);
  },
);

test('FR2-AC4: opening Branch 2 leaves Branch 1 open', { tag: '@regression' }, async ({ page }) => {
  const ui = await openTable(page);

  await toggleByName(ui, 'Branch 1');
  await toggleByName(ui, 'Branch 2');

  await expect(rowOf(ui, 'Branch 1')).toHaveAttribute('aria-expanded', 'true');
  await expect(rowOf(ui, 'Branch 2')).toHaveAttribute('aria-expanded', 'true');
  await expect(rowOf(ui, 'Anna Blackwood')).toBeVisible();
  await expect(rowOf(ui, 'Priya Nair')).toBeVisible();
});

test(
  'FR2-AC5: clicking a monthly figure opens, closes and changes nothing',
  { tag: '@regression' },
  async ({ page }) => {
    const ui = await openTable(page);
    const before = await ui.table.innerHTML();

    // A closed row's figure, and an open row's figure.
    await figureOf(ui, 'Branch 1', 'Jun 2024').click();
    await figureOf(ui, 'Company', 'Feb 2024').click();
    await settled(ui);

    await expect(ui.rowNames).toHaveText(CLOSED);
    await expect(rowOf(ui, 'Branch 1')).toHaveAttribute('aria-expanded', 'false');
    await expect(rowOf(ui, 'Company')).toHaveAttribute('aria-expanded', 'true');
    expect(await ui.table.innerHTML()).toBe(before);
  },
);

test(
  "FR2-AC6: the outline on one of Anna's channel figures moves to Branch 1 when Branch 1 is closed by click",
  { tag: '@regression' },
  async ({ page }) => {
    const ui = await openTable(page);
    await tabIntoTable(page, ui);
    // Branch 1 → open → Anna → open → her first channel → its Feb 2024 figure.
    await press(page, 'ArrowDown', 'Enter', 'ArrowDown', 'Enter', 'ArrowDown', 'ArrowRight');
    await settled(ui);
    await expect(figureOf(ui, ANNA_CHANNELS[0], 'Feb 2024')).toBeFocused();

    await toggleByName(ui, 'Branch 1');

    await expect(rowOf(ui, 'Branch 1')).toBeFocused();
    await expect(ui.table.locator('[tabindex="0"]')).toHaveCount(1);
  },
);

test(
  'FR2-AC7: the outline on an adviser moves to Branch 1 when it closes, and Down then reaches Branch 2',
  { tag: '@regression' },
  async ({ page }) => {
    const ui = await openTable(page);
    await tabIntoTable(page, ui);
    await press(page, 'ArrowDown', 'Enter', 'ArrowDown', 'ArrowDown');
    await expect(rowOf(ui, 'James Walker')).toBeFocused();

    await toggleByName(ui, 'Branch 1');
    await expect(rowOf(ui, 'Branch 1')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(rowOf(ui, 'Branch 2')).toBeFocused();
  },
);

test(
  'FR2-AC6/AC7 (negative): closing a row the outline is not inside leaves the outline where it is',
  { tag: '@regression' },
  async ({ page }) => {
    const ui = await openTable(page);
    await toggleByName(ui, 'Branch 1');
    await tabIntoTable(page, ui);
    await press(page, 'End', 'ArrowRight');
    const figure = figureOf(ui, 'Branch 3', 'Feb 2024');
    await expect(figure).toBeFocused();

    // Moving the mouse to close Branch 1 must not take the outline with it.
    await nameOf(ui, 'Branch 1').dispatchEvent('click');
    await settled(ui);

    await expect(rowOf(ui, 'Branch 1')).toHaveAttribute('aria-expanded', 'false');
    await expect(figure).toBeFocused();
  },
);
