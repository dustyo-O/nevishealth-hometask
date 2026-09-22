// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR4 "Failed state" — Retry: the same rules again (one automatic second attempt, the same
// address switches), the placeholders while it works, then the content or the panel; never a
// reload. Keyboard: Tab reaches Retry, Enter or Space retries.
import { expect, test } from '@playwright/test';
import { installClientsDouble, queriesOf } from './support/clients-double';
import {
  clientsPage,
  expectTableLoaded,
  isSameDocument,
  markDocument,
  TEXT,
} from './support/clients-page';

/** FR4-AC4: "the same error panel returns within 3 seconds" of clicking Retry. */
const PANEL_BUDGET_MS = 3000;

test(
  'FR4-AC4: the problem persists → placeholders while it retries, then the same panel within 3 s, no reload',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page, { mode: 'fail' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.alert).toContainText(TEXT.message);
    await markDocument(page);
    const requestsBefore = double.requests.length;

    await ui.retry.click();

    // The placeholder cards are back while it works. Nothing is announced: this failure
    // returns inside the announcement's own wait (FR3 amended 2026-09-22, FR4-AC5).
    await expect(ui.grid).toHaveAttribute('aria-busy', 'true');
    await expect(ui.chartCard).toBeVisible();
    await expect(ui.tableCard).toBeVisible();
    await expect(ui.alert).toHaveCount(0);

    // …then the same panel again.
    await expect(ui.alert).toContainText(TEXT.message, { timeout: PANEL_BUDGET_MS });
    await expect(ui.alert).toContainText(TEXT.detail.status500);
    await expect(ui.retry).toBeVisible();
    await expect(ui.status).toHaveText('');
    expect(double.requests.length).toBeGreaterThan(requestsBefore);
    expect(await isSameDocument(page)).toBe(true);
  },
);

test(
  'FR4-AC6: the service is back → Retry brings the loaded content without a reload',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page, { mode: 'network' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.alert).toContainText(TEXT.detail.network);
    await markDocument(page);
    const urlBefore = page.url();

    double.mode = 'ok';
    await ui.retry.click();

    await expect(ui.chartCard).toHaveText(TEXT.period);
    await expectTableLoaded(ui);
    await expect(ui.alert).toHaveCount(0);
    await expect(ui.grid).toHaveAttribute('aria-busy', 'false');
    expect(page.url()).toBe(urlBefore);
    expect(await isSameDocument(page)).toBe(true);
  },
);

test(
  'FR4-AC7 / FR6-AC2: opened with ?fail=1, every attempt and every Retry carries the switch; only the plain address clears it',
  { tag: '@regression' },
  async ({ page }) => {
    // The double is in `ok` mode: the failures below come from the switch the page forwards.
    const double = await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/?fail=1');
    await expect(ui.alert).toContainText(TEXT.detail.status500);
    expect(double.requests.length).toBeGreaterThanOrEqual(2);
    expect(queriesOf(double).every((query) => query === '?fail=1')).toBe(true);
    const requestsBefore = double.requests.length;

    await ui.retry.click();
    await expect(ui.grid).toHaveAttribute('aria-busy', 'true');
    await expect(ui.alert).toContainText(TEXT.detail.status500, { timeout: PANEL_BUDGET_MS });
    expect(double.requests.length).toBeGreaterThan(requestsBefore);
    expect(queriesOf(double).every((query) => query === '?fail=1')).toBe(true);

    // Changing a switch means changing the address.
    await page.goto('/');
    await expectTableLoaded(ui);
    await expect(ui.alert).toHaveCount(0);
    expect(queriesOf(double).at(-1)).toBe('');
  },
);

test(
  'FR4-AC11: Tab reaches Retry; Enter and Space each retry',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page, { mode: 'fail' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.alert).toContainText(TEXT.message);

    await page.keyboard.press('Tab');
    await expect(ui.retry).toBeFocused();
    let requestsBefore = double.requests.length;
    await page.keyboard.press('Enter');
    await expect(ui.grid).toHaveAttribute('aria-busy', 'true');
    // The button just left under the keyboard user; focus is parked on the heading (tech doc D-11).
    await expect(ui.heading).toBeFocused();
    await expect(ui.alert).toContainText(TEXT.message, { timeout: PANEL_BUDGET_MS });
    expect(double.requests.length).toBeGreaterThan(requestsBefore);

    await page.keyboard.press('Tab');
    await expect(ui.retry).toBeFocused();
    requestsBefore = double.requests.length;
    await page.keyboard.press('Space');
    await expect(ui.grid).toHaveAttribute('aria-busy', 'true');
    await expect(ui.alert).toContainText(TEXT.message, { timeout: PANEL_BUDGET_MS });
    expect(double.requests.length).toBeGreaterThan(requestsBefore);
  },
);

test('Retry after a recovery does not reappear: the loaded page has no Retry button', async ({
  page,
}) => {
  const double = await installClientsDouble(page, { mode: 'fail' });
  const ui = clientsPage(page);

  await page.goto('/');
  await expect(ui.retry).toBeVisible();

  double.mode = 'ok';
  await ui.retry.click();
  await expectTableLoaded(ui);

  await expect(ui.retry).toHaveCount(0);
  // Still no button anywhere: slice 1's table reserves the chevron's place without drawing a
  // control in it, so the loaded page offers nothing to press (spec 002 §2.4).
  await expect(page.getByRole('button')).toHaveCount(0);
});
