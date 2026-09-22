// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR5 "Loaded state (honest placeholders)": the two cards summarise the loaded data — computed
// from it, not typed in — and the page never fetches again on its own.
import { expect, test } from '@playwright/test';
import { clientsOk, companyWith, installClientsDouble, noBranches } from './support/clients-double';
import { clientsPage, TEXT } from './support/clients-page';

test(
  'FR5-AC1: the heading, "12 months · Feb 2024 – Jan 2025" in the chart card, "Company · 3 branches" in the table card',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/');

    await expect(ui.heading).toHaveText(TEXT.heading);
    await expect(ui.chartCard).toHaveText(TEXT.period);
    await expect(ui.tableCard).toHaveText(TEXT.branches);
    await expect(ui.alert).toHaveCount(0);
    await expect(ui.retry).toHaveCount(0);
  },
);

test(
  'FR5-AC2: two branches → "Company · 2 branches" — the summary is computed from the data',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: clientsOk(companyWith(2)) });
    const ui = clientsPage(page);

    await page.goto('/');

    await expect(ui.tableCard).toHaveText('Company · 2 branches');
    await expect(ui.chartCard).toHaveText(TEXT.period);
  },
);

test(
  'FR5-AC3: no branches at all → "Company · 0 branches" and no error',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: noBranches() });
    const ui = clientsPage(page);

    await page.goto('/');

    await expect(ui.tableCard).toHaveText('Company · 0 branches');
    await expect(ui.alert).toHaveCount(0);
  },
);

test(
  'one branch reads "Company · 1 branch" (tech doc D-12)',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: clientsOk(companyWith(1)) });
    const ui = clientsPage(page);

    await page.goto('/');

    await expect(ui.tableCard).toHaveText('Company · 1 branch');
  },
);

test(
  'FR5-AC4: switching to another tab and back triggers no new loading — the figures are fetched once',
  { tag: '@regression' },
  async ({ page, context }) => {
    const double = await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.tableCard).toHaveText(TEXT.branches);
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
    await expect(ui.tableCard).toHaveText(TEXT.branches);
    expect(double.requests.length).toBe(requestsAfterLoad);
    await other.close();
  },
);
