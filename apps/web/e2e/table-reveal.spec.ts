// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR2 (amended 2026-09-23): opening a row brings what it reveals into view — the page scrolls the
// least it can to show the opened row and as many of its new rows as fit; when more appear than
// the screen holds, the opened row and the first new one both stay on screen; closing scrolls
// nothing. And FR3 (amended the same day): the outline never comes to rest flush against the
// window's edge. Browser-only — jsdom has no layout, and the rows slide (D-8), so every
// measurement is taken once the motion has settled, never during it.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { item, twelve, type Item } from './support/clients-double';
import type { ClientsPage } from './support/clients-page';
import { VIEWPORT } from './support/clients-page';
import {
  BRANCH_1_ADVISERS,
  figureOf,
  nameOf,
  openTable,
  press,
  rectOf,
  rowOf,
  settled,
  shippedClients,
  tabIntoTable,
} from './support/table';

const TOLERANCE = 1;
/** "Clear of the edge": at least this much of the window between the outline and its edge. */
const CLEAR = 8;
/** …and no more than this, or the page moved further than it had to. */
const AT_MOST = 32;
/** `--table-row-h`. */
const ROW_H = 56;

const SIZES = [
  { name: '1440×700', viewport: { width: 1440, height: 700 } },
  { name: '375×812', viewport: VIEWPORT.phone },
] as const;

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const innerHeight = (page: Page) => page.evaluate(() => window.innerHeight);

/**
 * Scrolls the page to bring the row's top as near `top` px from the top of the viewport as the
 * page's own length allows, and says where it landed.
 */
const scrollRowTo = async (row: Locator, top: number) => {
  await row.evaluate((tr, wanted) => {
    window.scrollBy(0, tr.getBoundingClientRect().top - wanted);
  }, top);
  return (await rectOf(row)).top;
};

/**
 * Puts the row low on the screen — 120 px from the bottom, or as low as the page lets it sit —
 * and checks that `revealing` rows opening beneath it would really run past the fold.
 */
const putLow = async (page: Page, row: Locator, revealing: number) => {
  const height = await innerHeight(page);
  const top = await scrollRowTo(row, height - 120);
  expect(top + (revealing + 1) * ROW_H, 'the new rows would open below the fold').toBeGreaterThan(
    height,
  );
};

/** Puts the row exactly `top` px from the top of the viewport. */
const placeRow = async (row: Locator, top: number) => {
  expect(Math.abs((await scrollRowTo(row, top)) - top)).toBeLessThan(TOLERANCE);
};

/**
 * Nothing is moving any more: no row is sliding, the page has stopped scrolling, and it has held
 * still for two frames — the reveal waits for the rows' final geometry, so the test does too.
 */
const still = async (page: Page, ui: ClientsPage) => {
  await settled(ui);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  let last = await scrollY(page);
  await expect
    .poll(async () => {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const now = await scrollY(page);
      const same = now === last;
      last = now;
      return same;
    })
    .toBe(true);
};

/** The rows currently shown directly beneath `name`'s row, one level deeper. */
const revealedUnder = (ui: ClientsPage, names: readonly string[]) =>
  names.map((name) => rowOf(ui, name));

for (const { name, viewport } of SIZES) {
  test.describe(`at ${name}`, () => {
    test.use({ viewport });

    test(
      'FR2: opening Branch 1 low on the screen scrolls just enough to show it and all five advisers',
      { tag: '@regression' },
      async ({ page }) => {
        const ui = await openTable(page);
        const branch = rowOf(ui, 'Branch 1');
        const height = await innerHeight(page);
        // Low enough that, left alone, some of the five advisers would open below the fold.
        await putLow(page, branch, BRANCH_1_ADVISERS.length);
        const before = await scrollY(page);

        await nameOf(ui, 'Branch 1').click();
        await still(page, ui);

        const opened = await rectOf(branch);
        expect(opened.top, 'the opened row is still on screen').toBeGreaterThanOrEqual(0);
        for (const row of revealedUnder(ui, BRANCH_1_ADVISERS)) {
          expect((await rectOf(row)).bottom).toBeLessThanOrEqual(height);
        }
        // The least it can: the last adviser comes to rest just clear of the bottom edge.
        const last = await rectOf(rowOf(ui, 'Sarah Smith'));
        const gap = height - last.bottom;
        expect(gap, 'the last new row rests clear of the edge').toBeGreaterThanOrEqual(CLEAR);
        expect(gap, 'and the page moved no further than that').toBeLessThanOrEqual(AT_MOST);
        expect(await scrollY(page)).toBeGreaterThan(before);
      },
    );

    test(
      'FR2: opening a row from the keyboard reveals its rows the same way',
      { tag: '@regression' },
      async ({ page }) => {
        const ui = await openTable(page);
        await tabIntoTable(page, ui);
        await press(page, 'ArrowDown');
        const branch = rowOf(ui, 'Branch 1');
        await expect(branch).toBeFocused();
        const height = await innerHeight(page);
        await putLow(page, branch, BRANCH_1_ADVISERS.length);

        await page.keyboard.press('Enter');
        await still(page, ui);

        expect((await rectOf(branch)).top).toBeGreaterThanOrEqual(0);
        const gap = height - (await rectOf(rowOf(ui, 'Sarah Smith'))).bottom;
        expect(gap).toBeGreaterThanOrEqual(CLEAR);
        expect(gap).toBeLessThanOrEqual(AT_MOST);
      },
    );

    test(
      'FR2: opening a row whose new rows are already in view scrolls nothing',
      { tag: '@regression' },
      async ({ page }) => {
        const ui = await openTable(page);
        // Branch 1 open, so the page is long enough to bring Anna Blackwood near the top.
        await nameOf(ui, 'Branch 1').click();
        await still(page, ui);
        const top = await scrollRowTo(rowOf(ui, 'Anna Blackwood'), 100);
        const channels = 3;
        expect(top + (channels + 1) * ROW_H + AT_MOST).toBeLessThan(await innerHeight(page));
        const before = await scrollY(page);

        await nameOf(ui, 'Anna Blackwood').click();
        await still(page, ui);

        expect(await scrollY(page)).toBe(before);
      },
    );

    test('FR2: closing a row scrolls nothing', { tag: '@regression' }, async ({ page }) => {
      const ui = await openTable(page);
      await nameOf(ui, 'Branch 1').click();
      await still(page, ui);
      const anna = rowOf(ui, 'Anna Blackwood');
      await nameOf(ui, 'Anna Blackwood').click();
      await still(page, ui);
      // Low on the screen, where opening it would have scrolled.
      await placeRow(anna, (await innerHeight(page)) - 120);
      const before = await scrollY(page);
      expect(before).toBeGreaterThan(0);

      await nameOf(ui, 'Anna Blackwood').click();
      await expect(anna).toHaveAttribute('aria-expanded', 'false');
      await still(page, ui);

      expect(await scrollY(page)).toBe(before);
    });
  });
}

/** Branch 1 with more advisers than any screen here can hold at once. */
const withManyAdvisers = () => {
  const body = shippedClients();
  const branch = body.company.branches?.[0] as Item;
  branch.employees = Array.from({ length: 20 }, (_, i) => ({
    ...item(`many-${i + 1}`, `Adviser ${i + 1}`),
    values: twelve(i + 1),
  }));
  return body;
};

test.describe('a row that reveals more rows than the screen can hold', () => {
  test.use({ viewport: { width: 1440, height: 700 } });

  test(
    'FR2: the opened row and its first new row both stay on screen — the page never carries the user past the row they clicked',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page, withManyAdvisers());
      const branch = rowOf(ui, 'Branch 1');
      const height = await innerHeight(page);
      await putLow(page, branch, 20);
      const before = await scrollY(page);

      await nameOf(ui, 'Branch 1').click();
      await still(page, ui);

      expect(await scrollY(page), 'the page did bring the new rows up').toBeGreaterThan(before);
      const opened = await rectOf(branch);
      expect(opened.top, 'the opened row rests clear of the top edge').toBeGreaterThanOrEqual(
        CLEAR,
      );
      // As many new rows as fit are showing, so less than one more row's height is left above.
      expect(opened.top, 'and no lower than it had to').toBeLessThan(ROW_H + AT_MOST);
      const first = await rectOf(rowOf(ui, 'Adviser 1'));
      expect(first.bottom, 'the first new row is on screen').toBeLessThanOrEqual(height);
    },
  );
});

test.describe('FR3: the outline never rests flush against the edge', () => {
  test.use({ viewport: { width: 1440, height: 700 } });

  /** Walks `key` from the focused element `steps` times, checking the outline at every stop. */
  const walk = async (
    page: Page,
    key: 'ArrowDown' | 'ArrowUp',
    targets: Locator[],
    measured: number[],
  ) => {
    const height = await innerHeight(page);
    for (const target of targets) {
      await page.keyboard.press(key);
      await expect(target).toBeFocused();
      const { top, bottom } = await rectOf(target);
      const gaps = { top, bottom: height - bottom };
      measured.push(Math.min(gaps.top, gaps.bottom));
      expect(gaps.top, 'clear of the top edge').toBeGreaterThanOrEqual(CLEAR);
      expect(gaps.bottom, 'clear of the bottom edge').toBeGreaterThanOrEqual(CLEAR);
    }
  };

  const openEverything = async (page: Page, ui: ClientsPage) => {
    await nameOf(ui, 'Branch 1').click();
    await still(page, ui);
    for (const adviser of BRANCH_1_ADVISERS) {
      const row = rowOf(ui, adviser);
      if ((await row.getAttribute('aria-expanded')) === 'false') {
        await nameOf(ui, adviser).click();
        await still(page, ui);
      }
    }
  };

  test('arrowing down and back up through the rows', { tag: '@regression' }, async ({ page }) => {
    const ui = await openTable(page);
    await openEverything(page, ui);
    await page.evaluate(() => window.scrollTo(0, 0));
    await tabIntoTable(page, ui);
    const rows = await ui.table.locator('tbody tr').all();
    const measured: number[] = [];
    await walk(page, 'ArrowDown', rows.slice(1), measured);
    // It did have to scroll for this to mean anything.
    expect(await scrollY(page)).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await walk(page, 'ArrowUp', rows.slice(0, -1).reverse(), measured);
    test.info().annotations.push({ type: 'smallest gap', description: `${Math.min(...measured)}` });
  });

  test(
    'arrowing down and back up through a month of figures',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await openEverything(page, ui);
      await page.evaluate(() => window.scrollTo(0, 0));
      await tabIntoTable(page, ui);
      await page.keyboard.press('ArrowRight');
      await expect(figureOf(ui, 'Company', 'Feb 2024')).toBeFocused();
      const rows = await ui.table.locator('tbody tr').all();
      const cells = rows.map((row) => row.getByRole('gridcell').first());
      const measured: number[] = [];
      await walk(page, 'ArrowDown', cells.slice(1), measured);
      expect(await scrollY(page)).toBeGreaterThan(0);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await walk(page, 'ArrowUp', cells.slice(0, -1).reverse(), measured);
      test
        .info()
        .annotations.push({ type: 'smallest gap', description: `${Math.min(...measured)}` });
    },
  );
});
