// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR5 "Loaded state (honest placeholders)": the two cards show the loaded data — computed from
// it, not typed in — and the page never fetches again on its own.
//
// Spec 002 FR7 replaced the lower card's summary line ("Company · 3 branches") with the monthly
// detail table, so "the figures have arrived" is now the Company row and the branches open
// beneath it. Everything else here is spec 001's and still true.
import { expect, test } from '@playwright/test';
import { clientsOk, companyWith, installClientsDouble, noBranches } from './support/clients-double';
import { clientsPage, expectTableLoaded, TEXT } from './support/clients-page';

test(
  'FR5-AC1: the heading, "12 months · Feb 2024 – Jan 2025" in the chart card, the Company row and its three branches in the table card',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/');

    await expect(ui.heading).toHaveText(TEXT.heading);
    await expect(ui.chartCard).toHaveText(TEXT.period);
    await expectTableLoaded(ui);
    await expect(ui.alert).toHaveCount(0);
    await expect(ui.retry).toHaveCount(0);
  },
);

test(
  'FR5-AC2: two branches → two branch rows — the lower card is built from the data, not typed in',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: clientsOk(companyWith(2)) });
    const ui = clientsPage(page);

    await page.goto('/');

    await expectTableLoaded(ui, ['Company', 'Branch 1', 'Branch 2']);
    await expect(ui.chartCard).toHaveText(TEXT.period);
  },
);

test(
  'FR5-AC3 / 002 FR7-AC3: no branches at all → the Company row on its own, and no error',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: noBranches() });
    const ui = clientsPage(page);

    await page.goto('/');

    await expectTableLoaded(ui, ['Company']);
    await expect(ui.alert).toHaveCount(0);
  },
);

// The singular-branch wording spec 001 D-12 called for ("Company · 1 branch") went with the
// summary line; a single branch is still its own case, and it is now one row under the Company.
test('one branch → one branch row', { tag: '@regression' }, async ({ page }) => {
  await installClientsDouble(page, { body: clientsOk(companyWith(1)) });
  const ui = clientsPage(page);

  await page.goto('/');

  await expectTableLoaded(ui, ['Company', 'Branch 1']);
});

test(
  'FR5-AC4: switching to another tab and back triggers no new loading — the figures are fetched once',
  { tag: '@regression' },
  async ({ page, context }) => {
    const double = await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/');
    await expectTableLoaded(ui);
    const requestsAfterLoad = double.requests.length;

    // Another tab comes to the front, then this one again. Headless Chromium keeps every tab
    // "visible", so the page is also sent the events a real tab switch raises: hidden, then
    // visible and focused (the fetch policy listens for exactly these).
    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    await page.bringToFront();
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(1000);

    await expect(ui.status).toHaveText('');
    await expect(ui.grid).toHaveAttribute('aria-busy', 'false');
    await expectTableLoaded(ui);
    expect(double.requests.length).toBe(requestsAfterLoad);
    await other.close();
  },
);
