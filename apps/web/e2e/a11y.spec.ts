// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// The shell's basic accessibility (FR3, FR4): an axe audit of every state, at desktop and at
// 375 px, finds nothing at all.
//
// At 375 the months scroll, and axe asks a scroll container for keyboard access
// (`scrollable-region-focusable`). Slice 1 could not answer it and the case was `test.fixme`d;
// spec 002's roving `tabindex` answers it properly, because the row the outline is on is a real
// tab stop inside the scroller. The scroller itself must never be given a `tabindex` — that
// would be a second stop in the page and contradict FR3-AC1.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installClientsDouble, type ClientsMode } from './support/clients-double';
import {
  clientsPage,
  expectTableLoaded,
  TEXT,
  VIEWPORT,
  type ClientsPage,
} from './support/clients-page';

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
    // Since spec 002 FR7 the lower card holds the table itself, so the audit runs over the real
    // treegrid — its levels, its row headers and the `headers` on every figure.
    settled: (ui) => expectTableLoaded(ui),
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
  await expectTableLoaded(ui);

  // Still in the document once loaded, silent — so its next text change is announced.
  await expect(ui.status).toHaveCount(1);
  await expect(ui.status).toHaveText('');
});
