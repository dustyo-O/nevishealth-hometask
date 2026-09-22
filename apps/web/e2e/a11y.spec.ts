// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// The shell's basic accessibility (FR3, FR4): an axe audit of every state, at desktop and at
// 375 px, finds nothing — with one documented exception at 375 px, marked `test.fixme` below.
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
        // Known until slice 3: the scroller has no focusable content until the rows carry the
        // roving tabindex (tech doc D-9), and slice 1 deliberately did not give the scroller a
        // `tabindex` of its own — that would be a second tab stop and contradict FR3-AC1.
        // `scrollable-region-focusable` is therefore expected here, and only here: at 1440 the
        // months all fit, so nothing scrolls and nothing is flagged. Slice 3's task removes this
        // fixme and asserts 0 violations at 375 too.
        test.fixme(
          viewportName === 'phone' && name === 'loaded',
          'scrollable-region-focusable: the months scroll with nothing focusable inside them until slice 3',
        );

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
