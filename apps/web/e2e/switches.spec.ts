// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR6 "Demonstration switches on the page" in development: the page forwards `?delay` and
// `?fail` from its own address to the service, so any state is reachable by address alone.
// The double honours the switches exactly as the service does (FR2-AC7–AC9), so the timings
// here are the timings a reviewer sees with the real service.
import { expect, test } from '@playwright/test';
import { installClientsDouble, queriesOf, waitSinceFirstRequest } from './support/clients-double';
import { clientsPage, TEXT } from './support/clients-page';

const DELAY_MS = 3000;

test(
  'FR6-AC2: /?fail=1 shows the failed state — the switch reaches the service',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/?fail=1');

    await expect(ui.alert).toContainText(TEXT.message, { timeout: 3000 });
    await expect(ui.alert).toContainText(TEXT.detail.status500);
    expect(queriesOf(double)).not.toHaveLength(0);
    expect(queriesOf(double).every((query) => query === '?fail=1')).toBe(true);
  },
);

test(
  'FR6-AC3: /?delay=3000&fail=1 keeps the placeholders for at least 6 s (two delayed attempts), then shows the panel within 9 s',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto(`/?delay=${DELAY_MS}&fail=1`);
    // The busy frame is immediate; the announcement follows on its own ~1 s wait (FR3 amended).
    await expect(ui.grid).toHaveAttribute('aria-busy', 'true', { timeout: 1000 });
    await expect(ui.status).toHaveText(TEXT.loading);

    // Both attempts wait for the service: no panel before two delays have passed.
    await waitSinceFirstRequest(double, 2 * DELAY_MS);
    await expect(ui.status).toHaveText(TEXT.loading);
    await expect(ui.alert).toHaveCount(0);

    const remaining = double.requests[0]!.at + 9000 - Date.now();
    await expect(ui.alert).toContainText(TEXT.detail.status500, { timeout: remaining });
    expect(double.requests.length).toBeGreaterThanOrEqual(2);
    expect(queriesOf(double).every((query) => query === `?delay=${DELAY_MS}&fail=1`)).toBe(true);
  },
);

test(
  'FR6: only the two switches travel; anything else in the address stays on the page',
  { tag: '@regression' },
  async ({ page }) => {
    const double = await installClientsDouble(page);
    const ui = clientsPage(page);

    await page.goto('/?utm=review&delay=abc&other=1');

    await expect(ui.tableCard).toHaveText(TEXT.branches);
    expect(queriesOf(double).every((query) => query === '?delay=abc')).toBe(true);
  },
);
