// @layer: e2e
// @spec: 004-supplied-payload-non-uniform-nesting
//
// Spec 004 FR1 and FR2, criterion by criterion, on the company exactly as the brief supplies it —
// the shipped file, read from the API's own asset (support/table.ts), never a tidied copy. The
// gaps are the requirement: if one of these tests is awkward because a branch has no advisers,
// the test changes, never the data.
import { expect, test, type Page } from '@playwright/test';
import { clientsPage, expectChartLoaded } from './support/clients-page';
import {
  ANNA_CHANNELS,
  BRANCH_1_ADVISERS,
  figureOf,
  MONTH_HEADINGS,
  namesAsRead,
  nameOf,
  openTable,
  rowOf,
  settled,
  shippedClients,
  toggleByName,
} from './support/table';
import type { ClientsPage } from './support/clients-page';

const BRANCHES = ['Branch 1', 'Branch 2', 'Branch 3'] as const;
const CHILDLESS_ADVISERS = BRANCH_1_ADVISERS.filter((name) => name !== 'Anna Blackwood');

/** Every figure a row shows, as text, in month order. */
const figuresOfRow = async (ui: ClientsPage, name: string): Promise<number[]> =>
  (await rowOf(ui, name).getByRole('gridcell').allInnerTexts()).map((text) => Number(text.trim()));

/** Everything a person could see change about the table: the rows, and which of them are open. */
const tableState = (ui: ClientsPage) =>
  ui.table
    .locator('tbody tr:not([inert])')
    .evaluateAll((rows) =>
      rows.map((row) => `${row.textContent}|${row.getAttribute('aria-expanded')}`),
    );

const openBranch1 = async (page: Page): Promise<ClientsPage> => {
  const ui = await openTable(page);
  await toggleByName(ui, 'Branch 1');
  return ui;
};

test.describe('FR1 — the company as it really is', () => {
  test(
    'AC1: the table shows Company, then Branch 1, Branch 2 and Branch 3, each with twelve figures',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);

      await expect(namesAsRead(ui)).toHaveText(['Company', ...BRANCHES]);
      for (const name of ['Company', ...BRANCHES]) {
        const figures = await figuresOfRow(ui, name);
        expect(figures, name).toHaveLength(MONTH_HEADINGS.length);
        expect(figures.every(Number.isInteger), name).toBe(true);
      }
    },
  );

  test(
    'AC2: Branch 2 and Branch 3 show no control to open them — and Branch 1, which has advisers, does',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);

      for (const name of ['Branch 2', 'Branch 3']) {
        await expect(rowOf(ui, name), name).not.toHaveAttribute('aria-expanded');
        await expect(rowOf(ui, name).locator('svg'), `${name} draws no chevron`).toHaveCount(0);
      }
      // The counterpart: a row with something beneath it does offer the control.
      await expect(rowOf(ui, 'Branch 1')).toHaveAttribute('aria-expanded', 'false');
      await expect(rowOf(ui, 'Branch 1').locator('svg')).not.toHaveCount(0);
    },
  );

  test(
    'AC3: opening Branch 1 shows its five advisers — Anna Blackwood, James Walker, Maria Gutierrez, Robert Chen and Sarah Smith',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openBranch1(page);

      await expect(namesAsRead(ui)).toHaveText([
        'Company',
        'Branch 1',
        ...BRANCH_1_ADVISERS,
        'Branch 2',
        'Branch 3',
      ]);
    },
  );

  test(
    'AC4: with Branch 1 open, only Anna Blackwood shows a control to open her row',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openBranch1(page);

      await expect(rowOf(ui, 'Anna Blackwood')).toHaveAttribute('aria-expanded', 'false');
      for (const name of CHILDLESS_ADVISERS) {
        await expect(rowOf(ui, name), name).not.toHaveAttribute('aria-expanded');
      }
      await expect(ui.table.locator('tbody tr[aria-expanded]:not([inert])')).toHaveCount(3);
    },
  );

  test(
    'AC5: opening Anna Blackwood shows her three acquisition channels — Existing clients, New organic and New paid',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openBranch1(page);
      await toggleByName(ui, 'Anna Blackwood');

      await expect(namesAsRead(ui)).toHaveText([
        'Company',
        'Branch 1',
        'Anna Blackwood',
        ...ANNA_CHANNELS,
        ...CHILDLESS_ADVISERS,
        'Branch 2',
        'Branch 3',
      ]);
    },
  );

  test(
    'AC6: trying to open Branch 2, Branch 3 or any adviser but Anna — by pointer or by keyboard — opens nothing and changes nothing',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openBranch1(page);
      const before = await tableState(ui);

      for (const name of ['Branch 2', 'Branch 3', ...CHILDLESS_ADVISERS]) {
        await nameOf(ui, name).click();
        await settled(ui);
        expect(await tableState(ui), `clicking ${name}`).toEqual(before);

        await rowOf(ui, name).focus();
        for (const key of ['Enter', 'ArrowRight']) {
          await page.keyboard.press(key);
          await settled(ui);
          expect(await tableState(ui), `${key} on ${name}`).toEqual(before);
        }
      }
    },
  );
});

test.describe('FR2 — the figures are the ones we were given', () => {
  test(
    'AC1: the Company row reads 301 for May although its three branches read 156, 87 and 36 — 279',
    { tag: '@regression' },
    async ({ page }) => {
      // The spec's example names the branches as "76, 27 and 156"; the supplied May figures are
      // 156, 87 and 36 (76 and 27 are Branch 2 and 3 in February). Both come to 279 — what the
      // criterion is about — and the data wins, as it has since spec 001.
      const ui = await openTable(page);

      await expect(figureOf(ui, 'Company', 'May 2024')).toHaveText('301');
      const branches: number[] = [];
      for (const name of BRANCHES) {
        branches.push(Number(await figureOf(ui, name, 'May 2024').innerText()));
      }
      expect(branches).toEqual([156, 87, 36]);
      expect(branches.reduce((sum, value) => sum + value, 0)).toBe(279);
    },
  );

  test(
    'AC2: with Branch 1 open it reads 214 for August although its five advisers come to 216',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openBranch1(page);

      await expect(figureOf(ui, 'Branch 1', 'Aug 2024')).toHaveText('214');
      let advisers = 0;
      for (const name of BRANCH_1_ADVISERS) {
        advisers += Number(await figureOf(ui, name, 'Aug 2024').innerText());
      }
      expect(advisers).toBe(216);
    },
  );

  test(
    'AC1–AC2: every row fully open shows exactly the figures supplied for it — none recalculated from beneath',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openBranch1(page);
      await toggleByName(ui, 'Anna Blackwood');
      const { company } = shippedClients();
      const branch1 = company.branches![0]!;
      const anna = branch1.employees![0]!;

      const supplied = [
        company,
        ...company.branches!,
        ...branch1.employees!.filter((adviser) => adviser.name !== 'Anna Blackwood'),
        anna,
      ];
      for (const node of supplied) {
        expect(await figuresOfRow(ui, node.name), node.name).toEqual(node.values);
      }
      // Channel names repeat nowhere else in this tree, so each row is Anna's own.
      for (const channel of anna.channels!) {
        expect(await figuresOfRow(ui, channel.name), channel.name).toEqual(channel.values);
      }
    },
  );

  test(
    'AC3: nowhere on the page is there a warning, badge or message about figures disagreeing',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openBranch1(page);
      await toggleByName(ui, 'Anna Blackwood');

      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(
        page.getByText(
          /discrepan|disagree|do(es)? not add up|doesn.t add up|mismatch|inconsisten|warning/i,
        ),
      ).toHaveCount(0);
      // The page's live region stays quiet once loaded; the chart's speaks only of a month.
      await expect(ui.status).toHaveText('');
    },
  );

  test(
    'AC4: given figures that disagree, the dashboard loads and shows them normally rather than failing',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await expectChartLoaded(ui);

      await expect(clientsPage(page).retry).toHaveCount(0);
      await expect(figureOf(ui, 'Company', 'May 2024')).toHaveText('301');
    },
  );
});
