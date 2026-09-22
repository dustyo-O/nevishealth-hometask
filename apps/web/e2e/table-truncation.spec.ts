// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR5-AC3…AC5: a name too long for its column is shortened with an ellipsis on one line, and
// shown whole on hover and when the outline moves onto it (D-13's overlay — `title` alone never
// appears on keyboard focus). The shipped data never truncates, so AC3/AC4 use a routed copy
// with one long name; AC5 proves the shipped names all fit, at both widths, fully expanded.
import { expect, test, type Locator } from '@playwright/test';
import type { ClientsPage } from './support/clients-page';
import { VIEWPORT } from './support/clients-page';
import {
  expandAll,
  nameOf,
  namesAsRead,
  openTable,
  press,
  rectOf,
  rowOf,
  shippedClients,
  tabIntoTable,
} from './support/table';

const LONG = 'Branch 2 — North-Western Regional Office of Independent Advisers';

const withLongBranch = () => {
  const body = shippedClients();
  body.company.branches![1]!.name = LONG;
  return body;
};

const labelOf = (ui: ClientsPage, name: string): Locator => nameOf(ui, name).locator('[title]');

/** Is the label's whole text painted? (Its box is at least as wide as what it holds.) */
const shownWhole = (label: Locator) =>
  label.evaluate((el) => el.getBoundingClientRect().width + 0.5 >= el.scrollWidth);

for (const [width, viewport] of Object.entries(VIEWPORT)) {
  test.describe(`at ${viewport.width} px (${width})`, () => {
    test.use({ viewport });

    test(
      'FR5-AC3: a long name is shortened with an ellipsis on one line, the row keeps its height, hover shows it whole',
      { tag: '@regression' },
      async ({ page }) => {
        const ui = await openTable(page, withLongBranch());
        const label = labelOf(ui, LONG);

        const style = await label.evaluate((el) => {
          const s = getComputedStyle(el);
          return { overflow: s.textOverflow, wrap: s.whiteSpace };
        });
        expect(style).toEqual({ overflow: 'ellipsis', wrap: 'nowrap' });
        expect(await shownWhole(label)).toBe(false);
        const [long, short] = await Promise.all([
          rectOf(rowOf(ui, LONG)),
          rectOf(rowOf(ui, 'Branch 1')),
        ]);
        expect(long.bottom - long.top).toBe(short.bottom - short.top);
        // Still the full name for the pointer's tooltip and for a screen reader.
        await expect(label).toHaveAttribute('title', LONG);
        await expect(nameOf(ui, LONG)).toHaveAccessibleName(LONG);

        await nameOf(ui, LONG).hover();
        await expect.poll(() => shownWhole(label)).toBe(true);

        // Negative: moving away shortens it again.
        await nameOf(ui, 'Company').hover();
        await expect.poll(() => shownWhole(label)).toBe(false);
      },
    );

    test(
      'FR5-AC4: moving the outline onto a long name with the keyboard shows it whole',
      { tag: '@regression' },
      async ({ page }) => {
        const ui = await openTable(page, withLongBranch());
        const label = labelOf(ui, LONG);
        await page.mouse.move(0, 0);

        await tabIntoTable(page, ui);
        await press(page, 'ArrowDown', 'ArrowDown');
        await expect(rowOf(ui, LONG)).toBeFocused();
        await expect.poll(() => shownWhole(label)).toBe(true);

        // Negative: the outline leaves, and the name is shortened again.
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => shownWhole(label)).toBe(false);
      },
    );

    test(
      'FR5-AC5: with the shipped data fully open, no name is shortened',
      { tag: '@regression' },
      async ({ page }) => {
        // Opening every row, level by level, is some forty clicks — slow in WebKit.
        test.slow();
        const ui = await openTable(page);
        await expandAll(ui);

        const labels = await namesAsRead(ui).all();
        expect(labels.length).toBeGreaterThan(40);
        const cut = [];
        for (const label of labels) {
          if (!(await shownWhole(label))) cut.push(await label.textContent());
        }
        expect(cut).toEqual([]);
      },
    );
  });
}
