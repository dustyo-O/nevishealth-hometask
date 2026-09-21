// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR4-AC3 and FR4-AC5: a service that accepts the request and never answers. Two 10-second
// attempts half a second apart, so the placeholders stay for about 20 seconds before the panel
// says "Request timed out" — and Retry runs the same cycle again (tech doc D-13: as written).
import { expect, test } from '@playwright/test';
import { installClientsDouble, waitSinceFirstRequest } from './support/clients-double';
import { clientsPage, isSameDocument, markDocument, TEXT } from './support/clients-page';

/** Two attempts of 10 s, the second starting within 0.5 s of the first failing (FR4). */
const EXPECTED_PANEL_AT_MS = 20_500;
/** Still loading this long after the first request — well past one attempt, short of two. */
const STILL_LOADING_AT_MS = 18_000;
/** "The error appears within 2 seconds of the second attempt failing." */
const PANEL_DEADLINE_MS = EXPECTED_PANEL_AT_MS + 2000;

test(
  'FR4-AC3/AC5: the service never answers → placeholders for about 20 s, then "Request timed out"; Retry takes about 20 s again',
  { tag: '@regression' },
  async ({ page }) => {
    test.slow();
    const double = await installClientsDouble(page, { mode: 'hang' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expect(ui.status).toHaveText(TEXT.loading);
    await markDocument(page);

    // One attempt's worth of waiting is not enough for the panel: it is still loading.
    await waitSinceFirstRequest(double, STILL_LOADING_AT_MS);
    await expect(ui.status).toHaveText(TEXT.loading);
    await expect(ui.alert).toHaveCount(0);

    // Then the panel, by the second attempt's deadline.
    const remaining = double.requests[0]!.at + PANEL_DEADLINE_MS - Date.now();
    await expect(ui.alert).toContainText(TEXT.message, { timeout: remaining });
    await expect(ui.alert).toContainText(TEXT.detail.timeout);
    await expect(ui.retry).toBeVisible();
    await expect(ui.status).toHaveText('');
    expect(await isSameDocument(page)).toBe(true);

    // Retry, with the service still silent: the same cycle, the same panel.
    const retryClickedAt = Date.now();
    await ui.retry.click();
    await expect(ui.status).toHaveText(TEXT.loading);
    await expect(ui.chartCard).toBeVisible();

    await page.waitForTimeout(Math.max(0, retryClickedAt + STILL_LOADING_AT_MS - Date.now()));
    await expect(ui.status).toHaveText(TEXT.loading);
    await expect(ui.alert).toHaveCount(0);

    await expect(ui.alert).toContainText(TEXT.message, {
      timeout: Math.max(0, retryClickedAt + PANEL_DEADLINE_MS - Date.now()),
    });
    await expect(ui.alert).toContainText(TEXT.detail.timeout);
    await expect(ui.retry).toBeVisible();
    expect(await isSameDocument(page)).toBe(true);
  },
);
