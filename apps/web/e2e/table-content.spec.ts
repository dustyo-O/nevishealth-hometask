// @layer: e2e
// @spec: 002-monthly-detail-table
//
// FR1 (columns, levels, figures as recorded), FR4 (what a screen reader is given), FR5-AC1/AC2
// (initials) and FR7 (the table inside spec 001's states), in a real browser against the data
// the API ships. The unit suites prove each piece; this proves the page a manager opens.
//
// FR4 is the screen reader's view. What a reader *says* only the owner's VoiceOver pass can
// confirm ([User] device checks, slices 3 and 5); what is provable here is everything the reader
// is given to say it from — the roles, the level attributes, the header associations — as the
// browser resolves them.
import { expect, test } from '@playwright/test';
import { installClientsDouble } from './support/clients-double';
import { clientsPage, expectTableLoaded, TEXT } from './support/clients-page';
import {
  BRANCH_1_ADVISERS,
  figureOf,
  MONTH_HEADINGS,
  nameOf,
  openTable,
  rowOf,
  shippedClients,
  tabIntoTable,
  toggleByName,
} from './support/table';

const figuresOf = (row: ReturnType<typeof rowOf>) => row.getByRole('gridcell').allTextContents();

test.describe('FR1 — the table, its columns and its levels', () => {
  test(
    'FR1-AC1: the Company row, then its three branches one step in, each with its twelve figures from the data',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      const { company } = shippedClients();

      await expect(ui.table.getByRole('row')).toHaveCount(1 + 4);
      await expect(rowOf(ui, 'Company')).toHaveAttribute('aria-level', '1');
      await expect(rowOf(ui, 'Company')).toHaveAttribute('aria-expanded', 'true');
      expect(await figuresOf(rowOf(ui, 'Company'))).toEqual(company.values.map(String));

      for (const branch of company.branches ?? []) {
        const row = rowOf(ui, branch.name);
        await expect(row).toHaveAttribute('aria-level', '2');
        expect(await figuresOf(row)).toEqual(branch.values.map(String));
      }

      // "Indented one step": the name starts one indent step (28 px) further right.
      const textLeft = (name: string) =>
        nameOf(ui, name)
          .locator('[title]')
          .evaluate((el) => el.getBoundingClientRect().left);
      expect((await textLeft('Branch 1')) - (await textLeft('Company'))).toBeCloseTo(28, 0);
    },
  );

  test(
    'FR1-AC2: the Company row reads 250 for Feb 2024 and 350 for Jan 2025, as recorded',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);

      await expect(figureOf(ui, 'Company', 'Feb 2024')).toHaveText('250');
      await expect(figureOf(ui, 'Company', 'Jan 2025')).toHaveText('350');
    },
  );

  test(
    'FR1-AC2 (negative): a Company figure that differs from the sum of its branches is shown as recorded, not re-added',
    { tag: '@regression' },
    async ({ page }) => {
      // The shipped parents equal their children's sums, so they cannot tell the two apart
      // (review 2 F4); this copy breaks the equality on purpose.
      const body = shippedClients();
      body.company.values[0] = 7;
      const ui = await openTable(page, body);

      await expect(figureOf(ui, 'Company', 'Feb 2024')).toHaveText('7');
    },
  );

  test(
    'FR1-AC3: the first heading is blank on screen, the other twelve read Feb 2024 … Jan 2025',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      const headings = ui.table.getByRole('columnheader');

      await expect(headings).toHaveCount(13);
      await expect(headings.nth(0)).toHaveAccessibleName('Name');
      // Blank *on screen*: nothing of the name paints — it is clipped to nothing.
      const painted = await headings
        .nth(0)
        .getByText('Name')
        .evaluate((el) => {
          const { width, height } = el.getBoundingClientRect();
          return width * height > 1;
        });
      expect(painted).toBe(false);
      await expect(headings.filter({ hasNotText: 'Name' })).toHaveText([...MONTH_HEADINGS]);
    },
  );

  test(
    'FR1-AC4: an acquisition channel and a branch with no advisers offer no control to open',
    { tag: '@regression' },
    async ({ page }) => {
      const body = shippedClients();
      delete body.company.branches![2]!.employees;
      const ui = await openTable(page, body);

      await toggleByName(ui, 'Branch 1');
      await toggleByName(ui, 'Anna Blackwood');

      for (const leaf of ['Existing clients', 'Branch 3']) {
        await expect(rowOf(ui, leaf)).not.toHaveAttribute('aria-expanded');
        await expect(nameOf(ui, leaf).locator('svg')).toHaveCount(0);
        await nameOf(ui, leaf).click();
        await expect(rowOf(ui, leaf)).not.toHaveAttribute('aria-expanded');
      }
      // The negative counterpart: a row that has children does show its arrow.
      await expect(nameOf(ui, 'Branch 2').locator('svg')).toBeVisible();
    },
  );
});

test.describe('FR4 — what a screen reader is given', () => {
  test(
    'FR4-AC1: Branch 1 is at level 2, row 1 of 3, and reports whether it is open',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      const branch = rowOf(ui, 'Branch 1');

      await expect(nameOf(ui, 'Branch 1')).toHaveAccessibleName('Branch 1');
      await expect(branch).toHaveAttribute('aria-level', '2');
      await expect(branch).toHaveAttribute('aria-posinset', '1');
      await expect(branch).toHaveAttribute('aria-setsize', '3');
      await expect(branch).toHaveAttribute('aria-expanded', 'false');
      await toggleByName(ui, 'Branch 1');
      await expect(branch).toHaveAttribute('aria-expanded', 'true');
    },
  );

  test(
    'FR4-AC2: Anna Blackwood\'s Jun 2024 figure is tied to her name and to "Jun 2024"',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await toggleByName(ui, 'Branch 1');

      const june = figureOf(ui, 'Anna Blackwood', 'Jun 2024');
      await expect(june).toHaveText('32');
      const headers = await june.evaluate((cell) =>
        (cell.getAttribute('headers') ?? '')
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent?.trim()),
      );
      // The row header's text holds the circle's "AB" too; the circle is aria-hidden (FR5-AC2).
      expect(headers).toEqual(['Jun 2024', 'ABAnna Blackwood']);
      await expect(
        ui.table.locator(`#${(await june.getAttribute('headers'))!.split(' ')[1]}`),
      ).toHaveAccessibleName('Anna Blackwood');
    },
  );

  test(
    'FR4-AC2: every figure in the table names exactly one month heading and its own row',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await toggleByName(ui, 'Branch 1');

      const orphans = await ui.table.evaluate(
        (table) =>
          [...table.querySelectorAll('tbody td')].filter((cell) => {
            const [month, name] = (cell.getAttribute('headers') ?? '').split(' ');
            const monthTh = month === undefined ? null : document.getElementById(month);
            const nameTh = name === undefined ? null : document.getElementById(name);
            return (
              monthTh?.getAttribute('scope') !== 'col' ||
              nameTh?.closest('tr') !== cell.closest('tr')
            );
          }).length,
      );
      expect(orphans).toBe(0);
    },
  );

  test(
    'FR4-AC3: the blank first heading is announced as "Name"',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);

      await expect(ui.table.getByRole('columnheader', { name: 'Name', exact: true })).toHaveCount(
        1,
      );
    },
  );

  test(
    'FR4-AC4: opening a row with the keyboard changes its open state and adds no message of its own',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      const liveBefore = await page.locator('[aria-live], [role=status], [role=alert]').count();

      await tabIntoTable(page, ui);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await expect(rowOf(ui, 'Branch 1')).toBeFocused();
      await expect(rowOf(ui, 'Branch 1')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[aria-live], [role=status], [role=alert]')).toHaveCount(
        liveBefore,
      );
      // Spec 001's loading region stays silent: nothing is spoken but the row itself.
      await expect(ui.status).toHaveText('');
    },
  );

  test(
    'FR4-AC5: a row with nothing beneath it reports no open-or-closed state',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await toggleByName(ui, 'Branch 1');
      await toggleByName(ui, 'Anna Blackwood');

      const leaves = ui.table.locator('tbody tr[aria-level="4"]');
      await expect(leaves).toHaveCount(3);
      for (const leaf of await leaves.all())
        await expect(leaf).not.toHaveAttribute('aria-expanded');
    },
  );
});

test.describe('FR5 — reading an adviser row', () => {
  test(
    'FR5-AC1: each adviser in Branch 1 shows a circle with their initials before the name',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await toggleByName(ui, 'Branch 1');

      const initials = ['AB', 'JW', 'MG', 'RC', 'SS'];
      for (const [i, adviser] of BRANCH_1_ADVISERS.entries()) {
        const circle = nameOf(ui, adviser).getByText(initials[i]!, { exact: true });
        await expect(circle).toBeVisible();
        const [circleBox, nameBox] = await Promise.all([
          circle.boundingBox(),
          nameOf(ui, adviser).getByText(adviser, { exact: true }).boundingBox(),
        ]);
        expect(circleBox!.x).toBeLessThan(nameBox!.x);
      }
      // Negative: a branch and a channel carry no circle — their name is all their text.
      await toggleByName(ui, 'Anna Blackwood');
      for (const other of ['Branch 1', 'Existing clients']) {
        await expect(nameOf(ui, other)).toHaveText(other);
      }
      await expect(nameOf(ui, 'Anna Blackwood')).toHaveText('ABAnna Blackwood');
    },
  );

  test(
    'FR5-AC2: a screen reader reads the adviser name without the circle',
    { tag: '@regression' },
    async ({ page }) => {
      const ui = await openTable(page);
      await toggleByName(ui, 'Branch 1');

      await expect(nameOf(ui, 'Anna Blackwood')).toHaveAccessibleName('Anna Blackwood');
      await expect(nameOf(ui, 'Anna Blackwood').getByText('AB', { exact: true })).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      await expect(ui.table.getByRole('rowheader', { name: /AB/ })).toHaveCount(0);
    },
  );
});

test.describe('FR7 — while loading, and when something is wrong', () => {
  test(
    'FR7-AC1: slow figures → the placeholder blocks, then the table in their place',
    { tag: '@regression' },
    async ({ page }) => {
      const double = await installClientsDouble(page, { mode: 'hang', body: shippedClients() });
      const ui = clientsPage(page);

      await page.goto('/');
      await expect(ui.status).toHaveText(TEXT.loading);
      await expect(ui.tableCard.locator('[class*="_skeleton_"]').first()).toBeVisible();
      await expect(ui.table).toHaveCount(0);

      double.mode = 'ok';
      await page.reload();
      await expectTableLoaded(ui);
      await expect(ui.tableCard.locator('[class*="_skeleton_"]')).toHaveCount(0);
      await expect(figureOf(ui, 'Company', 'Feb 2024')).toHaveText('250');
    },
  );

  test(
    'FR7-AC2: figures that cannot load → the error and Retry in place of the table; Retry shows the table',
    { tag: '@regression' },
    async ({ page }) => {
      const double = await installClientsDouble(page, { mode: 'fail', body: shippedClients() });
      const ui = clientsPage(page);

      await page.goto('/');
      await expect(ui.alert).toContainText(TEXT.message);
      await expect(ui.table).toHaveCount(0);

      double.mode = 'ok';
      await ui.retry.click();
      await expectTableLoaded(ui);
      await expect(figureOf(ui, 'Company', 'Jan 2025')).toHaveText('350');
    },
  );

  test(
    'FR7-AC3: a company with no branches → the Company row alone, its twelve figures, nothing to open',
    { tag: '@regression' },
    async ({ page }) => {
      const body = shippedClients();
      delete body.company.branches;
      await installClientsDouble(page, { body });
      const ui = clientsPage(page);

      await page.goto('/');
      await expectTableLoaded(ui, ['Company']);
      await expect(rowOf(ui, 'Company').getByRole('gridcell')).toHaveCount(12);
      await expect(rowOf(ui, 'Company')).not.toHaveAttribute('aria-expanded');
      await expect(nameOf(ui, 'Company').locator('svg')).toHaveCount(0);
    },
  );
});
