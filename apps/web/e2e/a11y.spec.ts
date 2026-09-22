// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// The shell's basic accessibility (FR3, FR4): an axe audit of every state, at desktop and at
// 375 px, finds nothing.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installClientsDouble, type ClientsMode } from './support/clients-double';
import { clientsPage, TEXT, VIEWPORT, type ClientsPage } from './support/clients-page';

type State = { name: string; mode: ClientsMode; settled: (ui: ClientsPage) => Promise<void> };

const STATES: State[] = [
  {
    name: 'loading',
    mode: 'hang',
    settled: async (ui) => {
      await expect(ui.status).toHaveText(TEXT.loading);
      await expect(ui.tableCard).toBeVisible();
    },
  },
  {
    name: 'failed',
    mode: 'fail',
    settled: async (ui) => {
      await expect(ui.alert).toContainText(TEXT.message);
      await expect(ui.retry).toBeVisible();
    },
  },
  {
    name: 'loaded',
    mode: 'ok',
    settled: async (ui) => {
      await expect(ui.tableCard).toHaveText(TEXT.branches);
    },
  },
];

for (const [viewportName, viewport] of Object.entries(VIEWPORT)) {
  test.describe(`at ${viewport.width} px (${viewportName})`, () => {
    test.use({ viewport });

    for (const { name, mode, settled } of STATES) {
      test(`the ${name} state has no axe violations`, { tag: '@regression' }, async ({ page }) => {
        await installClientsDouble(page, { mode });
        const ui = clientsPage(page);

        await page.goto('/');
        await settled(ui);

        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations).toEqual([]);
      });
    }
  });
}

test('the loading announcement is a polite live region that exists before it speaks', async ({
  page,
}) => {
  await installClientsDouble(page);
  const ui = clientsPage(page);

  await page.goto('/');
  await expect(ui.tableCard).toHaveText(TEXT.branches);

  // Still in the document once loaded, silent — so its next text change is announced.
  await expect(ui.status).toHaveCount(1);
  await expect(ui.status).toHaveText('');
});
