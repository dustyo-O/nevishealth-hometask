// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR6-AC4 against the real production bundle (`vite build && vite preview`, tech doc D-9): the
// page ignores both switches — the request it makes carries no query, and the content appears
// at once.
import { expect, test } from '@playwright/test';
import { installClientsDouble, queriesOf } from '../support/clients-double';
import { clientsPage, expectTableLoaded, TEXT, expectChartLoaded } from '../support/clients-page';

test(
  'FR6-AC4: /?fail=1&delay=10000 → the loaded content appears at once, no panel, no switch forwarded',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/?fail=1&delay=10000');

    // No 10-second wait, no error panel.
    await expectChartLoaded(ui, 3000);
    await expectTableLoaded(ui);
    await expect(ui.alert).toHaveCount(0);
    // Exactly one request (no development double-mount here), with nothing forwarded.
    expect(double.requests).toHaveLength(1);
    expect(queriesOf(double)).toEqual(['']);
  },
);

test(
  'the production bundle renders the frame and the honest states',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page, { mode: 'fail' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.heading).toBeVisible();
    await expect(ui.alert).toContainText(TEXT.detail.status500, { timeout: 3000 });

    double.mode = 'ok';
    await ui.retry.click();
    await expectChartLoaded(ui);
    await expectTableLoaded(ui);
    await expect(ui.alert).toHaveCount(0);
  },
);
