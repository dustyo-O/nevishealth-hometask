// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR4 "Failed state": when the figures cannot be loaded, one panel replaces the two cards —
// the message, one line naming the failure, a Retry button — announced without moving focus.
import { expect, test } from '@playwright/test';
import {
  branchWithoutAdvisers,
  elevenFigures,
  installClientsDouble,
  twoLists,
  type ClientsDouble,
} from './support/clients-double';
import { clientsPage, expectTableLoaded, TEXT, type ClientsPage } from './support/clients-page';

/** FR4-AC1: "within 3 seconds they see, in place of the two cards, …". */
const PANEL_BUDGET_MS = 3000;

const expectPanel = async (ui: ClientsPage, detail: string) => {
  await expect(ui.alert).toContainText(TEXT.message, { timeout: PANEL_BUDGET_MS });
  await expect(ui.alert).toContainText(detail);
  await expect(ui.retry).toBeVisible();
  // In place of the two cards: no card, no placeholder, no "loading" left behind.
  await expect(ui.chartCard).toHaveCount(0);
  await expect(ui.tableCard).toHaveCount(0);
  await expect(ui.grid).toHaveAttribute('aria-busy', 'false');
  await expect(ui.status).toHaveText('');
  await expect(ui.heading).toBeVisible();
};

test(
  'FR4-AC1: the service answers with an error → the panel with "Request failed with status 500" and Retry, within 3 s',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { mode: 'fail' });
    const ui = clientsPage(page);

    await page.goto('/');

    await expectPanel(ui, TEXT.detail.status500);
  },
);

test(
  'FR4-AC2: the service is unreachable → the panel with "Network error", within 3 s',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { mode: 'network' });
    const ui = clientsPage(page);

    await page.goto('/');

    await expectPanel(ui, TEXT.detail.network);
  },
);

test(
  'FR4-AC8: a document of the wrong shape (an item with eleven figures) → "Unexpected data shape"',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: elevenFigures() });
    const ui = clientsPage(page);

    await page.goto('/');

    await expectPanel(ui, TEXT.detail.shape);
  },
);

test(
  'FR4-AC10: an item carrying two kinds of list beneath it → "Unexpected data shape"',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: twoLists() });
    const ui = clientsPage(page);

    await page.goto('/');

    await expectPanel(ui, TEXT.detail.shape);
  },
);

test(
  'FR4-AC9: a branch with no advisers is not a wrong shape — the loaded content appears',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { body: branchWithoutAdvisers() });
    const ui = clientsPage(page);

    await page.goto('/');

    await expectTableLoaded(ui);
    await expect(ui.chartCard).toHaveText(TEXT.period);
    await expect(ui.alert).toHaveCount(0);
  },
);

test(
  'FR4-AC11: the panel is announced without moving focus, and Tab reaches Retry',
  { tag: '@regression' },
  async ({ page }) => {
    await installClientsDouble(page, { mode: 'fail' });
    const ui = clientsPage(page);

    await page.goto('/');
    await expectPanel(ui, TEXT.detail.status500);

    // Announced: the text block is a live alert. Focus stayed where it was (on the document).
    await expect(ui.alert).toHaveAttribute('role', 'alert');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    await page.keyboard.press('Tab');
    await expect(ui.retry).toBeFocused();
  },
);

test('the panel names the message once and keeps the detail on its own line', async ({ page }) => {
  await installClientsDouble(page, { mode: 'fail' });
  const ui = clientsPage(page);

  await page.goto('/');
  await expectPanel(ui, TEXT.detail.status500);

  await expect(ui.alert.getByText(TEXT.message, { exact: true })).toHaveCount(1);
  await expect(ui.alert.getByText(TEXT.detail.status500, { exact: true })).toHaveCount(1);
});

test.describe('the same document, whichever way it failed', () => {
  const cases: { title: string; setup: (double: ClientsDouble) => void; detail: string }[] = [
    { title: 'error answer', setup: (d) => (d.mode = 'fail'), detail: TEXT.detail.status500 },
    { title: 'no connection', setup: (d) => (d.mode = 'network'), detail: TEXT.detail.network },
    { title: 'wrong shape', setup: (d) => (d.body = twoLists()), detail: TEXT.detail.shape },
  ];

  for (const { title, setup, detail } of cases) {
    test(`${title}: nothing else on the page is lost`, async ({ page }) => {
      const double = await installClientsDouble(page);
      setup(double);
      const ui = clientsPage(page);

      await page.goto('/');
      await expectPanel(ui, detail);

      await expect(page).toHaveTitle('Clients');
      await expect(page.getByRole('main')).toBeVisible();
      await expect(ui.heading).toHaveText(TEXT.heading);
    });
  }
});
