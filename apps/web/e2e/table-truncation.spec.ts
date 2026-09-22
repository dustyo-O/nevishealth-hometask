// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR5-AC3…AC5: a name too long for its column is shortened with an ellipsis on one line, and
// shown whole on hover and when the outline moves onto it (D-13's overlay — `title` alone never
// appears on keyboard focus). AC3/AC4 use a routed copy with one long name, at both widths.
// AC5 proves the shipped names all fit at the design width (1440), fully expanded. At 375 the
// name column narrows to 160 px (FR6, D-17a), so the deepest shipped names *are* shortened there;
// AC6 proves each of those is ellipsised and still reachable whole — title, accessible name,
// hover and keyboard focus. (The spec changed on 2026-09-22, not the implementation: AC5 used
// to claim "no name is shortened" at both widths.)
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

/**
 * Is the label's whole text painted on its own box? At least as wide *and as tall* as what it
 * holds: a reveal whose box collapses to 0 px high paints no background behind the name, and the
 * month figures it overlaps show through ("Anna Blackwood25", found at 375 on 2026-09-22).
 */
const shownWhole = (label: Locator) =>
  label.evaluate((el) => {
    const { width, height } = el.getBoundingClientRect();
    return width + 0.5 >= el.scrollWidth && height + 0.5 >= el.scrollHeight;
  });

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

    if (width === 'desktop') {
      test(
        'FR5-AC5: with the shipped data fully open at the design width, no name is shortened',
        { tag: '@regression' },
        async ({ page }) => {
          // Opening every row, level by level, is some forty clicks — slow in WebKit.
          test.slow();
          const ui = await openTable(page);
          await expandAll(ui);
          // Measure at rest: the pointer is still over the last name `expandAll` clicked.
          await page.mouse.move(0, 0);

          const labels = await namesAsRead(ui).all();
          expect(labels.length).toBeGreaterThan(40);
          const cut = [];
          for (const label of labels) {
            if (!(await shownWhole(label))) cut.push(await label.textContent());
          }
          expect(cut).toEqual([]);
        },
      );
    } else {
      test(
        'FR5-AC6: with the shipped data fully open at 375 px, a deep name that does not fit is ellipsised and still reachable whole',
        { tag: '@regression' },
        async ({ page }) => {
          test.slow();
          const ui = await openTable(page);
          await expandAll(ui);
          // Measure at rest: the pointer is still over the last name `expandAll` clicked.
          await page.mouse.move(0, 0);

          const labels = await namesAsRead(ui).all();
          expect(labels.length).toBeGreaterThan(40);
          const cut: Locator[] = [];
          for (const label of labels) if (!(await shownWhole(label))) cut.push(label);
          // The narrowed column (D-17a) does shorten the deepest names; if none were, this
          // criterion would be untested rather than passed.
          expect(cut.length).toBeGreaterThan(0);

          for (const label of cut) {
            const full = (await label.textContent())!;
            const style = await label.evaluate((el) => {
              const s = getComputedStyle(el);
              return { overflow: s.textOverflow, wrap: s.whiteSpace };
            });
            expect(style, full).toEqual({ overflow: 'ellipsis', wrap: 'nowrap' });
            // The full name for the pointer's tooltip and for a screen reader.
            await expect(label).toHaveAttribute('title', full);
            await expect(label.locator('xpath=ancestor::th[1]')).toHaveAccessibleName(full);
          }

          // Hover and keyboard focus reveal it whole — on the first shortened row.
          const label = cut[0]!;
          const row = label.locator('xpath=ancestor::tr[1]');
          await label.locator('xpath=ancestor::th[1]').hover();
          await expect.poll(() => shownWhole(label)).toBe(true);
          await page.mouse.move(0, 0);
          await expect.poll(() => shownWhole(label)).toBe(false);

          await tabIntoTable(page, ui);
          const isFocused = () => row.evaluate((el) => el === document.activeElement);
          for (let i = 0; i < labels.length && !(await isFocused()); i++) {
            await page.keyboard.press('ArrowDown');
          }
          await expect(row).toBeFocused();
          await expect.poll(() => shownWhole(label)).toBe(true);

          // Negative: the outline leaves, and the name is shortened again.
          await page.keyboard.press('ArrowUp');
          await expect.poll(() => shownWhole(label)).toBe(false);
        },
      );
    }
  });
}
