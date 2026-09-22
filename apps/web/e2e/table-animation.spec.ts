// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR2-AC8: rows slide in and out; under "reduce motion" they appear and disappear at once.
// D-16: the motion is a `translateY` slide, not the library's default scale-and-fade.
// D-15a: a leaving row is out of the accessibility tree the moment it starts to go.
//
// The library measures rows on a 500 ms debounce and never animates a row it has not measured
// yet (slice 4's ledger), so each test lets the table rest before toggling. Clicking and reading
// the animations happen inside one `evaluate`, so a 250 ms slide cannot finish in between.
import { expect, test, type Page } from '@playwright/test';
import type { ClientsPage } from './support/clients-page';
import {
  BRANCH_1_ADVISERS,
  nameOf,
  openTable,
  rowOf,
  settled,
  toggleByName,
} from './support/table';

const LIBRARY_DEBOUNCE_MS = 500;

type Motion = {
  /** Every running animation on a table row, with what it moves. */
  animations: { row: string; leaving: boolean; transforms: string[]; scales: boolean }[];
  /** Rows on their way out at that moment: hidden from AT and inert (D-15a). */
  leaving: { ariaHidden: string | null; inert: boolean }[];
};

/** Clicks the row's name and reports the motion one frame later. */
const clickAndWatch = (ui: ClientsPage, name: string): Promise<Motion> =>
  nameOf(ui, name).evaluate(async (th: HTMLElement) => {
    const table = th.closest('table')!;
    th.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const onRows = document
      .getAnimations()
      .filter(
        (a) =>
          a.effect instanceof KeyframeEffect &&
          a.effect.target instanceof HTMLTableRowElement &&
          table.contains(a.effect.target),
      );
    return {
      animations: onRows.map((a) => {
        const effect = a.effect as KeyframeEffect;
        const row = effect.target as HTMLTableRowElement;
        const frames = effect.getKeyframes();
        return {
          row: row.querySelector('[title]')?.textContent ?? '',
          leaving: row.hasAttribute('inert'),
          transforms: frames.map((f) => String(f.transform ?? '')),
          scales: frames.some((f) => /scale/.test(String(f.transform ?? ''))),
        };
      }),
      leaving: [...table.querySelectorAll('tbody tr[inert]')].map((tr) => ({
        ariaHidden: tr.getAttribute('aria-hidden'),
        inert: tr.hasAttribute('inert'),
      })),
    };
  });

const rest = (page: Page) => page.waitForTimeout(LIBRARY_DEBOUNCE_MS + 100);

test.describe('with motion', () => {
  // Tall enough that every row is above the fold: the library does not animate a row that
  // arrives off-screen (slice 4's ledger), which is right, but would make this test prove less.
  test.use({ viewport: { width: 1440, height: 1600 } });

  test(
    'FR2-AC8: opening slides the new rows in from above; closing slides them out and they leave the DOM',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await rest(page);

      const opening = await clickAndWatch(ui, 'Branch 1');
      const arriving = opening.animations.filter((a) => BRANCH_1_ADVISERS.includes(a.row as never));
      expect(arriving.map((a) => a.row).sort()).toEqual([...BRANCH_1_ADVISERS].sort());
      for (const a of arriving) {
        expect(a.transforms[0]).toMatch(/translateY\(-\d/);
        expect(a.transforms.at(-1)).toMatch(/translateY\(0/);
      }
      // The rows below travel down to make room — from where they were, 5 rows up — and
      // nothing scales (D-16).
      const below = opening.animations.find((a) => a.row === 'Branch 2');
      expect(below?.transforms[0]).toMatch(/translateY\(-\d/);
      expect(opening.animations.every((a) => !a.scales)).toBe(true);
      await settled(ui);
      await rest(page);

      const closing = await clickAndWatch(ui, 'Branch 1');
      const departing = closing.animations.filter((a) => a.leaving);
      expect(departing.map((a) => a.row).sort()).toEqual([...BRANCH_1_ADVISERS].sort());
      for (const a of departing) expect(a.transforms.at(-1)).toMatch(/translateY\(-\d/);
      // D-15a: out of the accessibility tree while still on screen.
      expect(closing.leaving).toHaveLength(5);
      for (const row of closing.leaving) expect(row).toEqual({ ariaHidden: 'true', inert: true });
      await expect(ui.table.getByRole('row')).toHaveCount(1 + 4);

      await settled(ui);
      await expect(ui.table.locator('tbody tr')).toHaveCount(4);
    },
  );

  test(
    'FR2-AC8: toggling a row ten times quickly settles on the right rows, nothing left behind',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await rest(page);

      for (let i = 0; i < 10; i += 1) {
        await nameOf(ui, 'Branch 1').click();
        await page.waitForTimeout(60);
      }

      await settled(ui);
      await expect(rowOf(ui, 'Branch 1')).toHaveAttribute('aria-expanded', 'false');
      await expect(ui.table.locator('tbody tr')).toHaveCount(4);
      const duplicateIds = await ui.table.evaluate((table) => {
        const ids = [...table.querySelectorAll('[id]')].map((el) => el.id);
        return ids.length - new Set(ids).size;
      });
      expect(duplicateIds).toBe(0);
    },
  );
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test(
    'FR2-AC8: rows appear and disappear at once, without movement',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await rest(page);

      const opening = await clickAndWatch(ui, 'Branch 1');
      expect(opening.animations).toEqual([]);
      await expect(rowOf(ui, 'Anna Blackwood')).toBeVisible();
      await rest(page);

      const closing = await clickAndWatch(ui, 'Branch 1');
      expect(closing.animations).toEqual([]);
      // Gone with the render that closed them — nothing lingers a frame later.
      expect(closing.leaving).toEqual([]);
      expect(await ui.table.locator('tbody tr').count()).toBe(4);
    },
  );

  test(
    'FR2-AC8 (negative): reduced motion changes nothing else — the same rows open and close',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);

      await toggleByName(ui, 'Branch 1');
      await toggleByName(ui, 'Anna Blackwood');
      await expect(rowOf(ui, 'New paid')).toBeVisible();
      await toggleByName(ui, 'Branch 1');
      await expect(ui.table.locator('tbody tr')).toHaveCount(4);
    },
  );
});
