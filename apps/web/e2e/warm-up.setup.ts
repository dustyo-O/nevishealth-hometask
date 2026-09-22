// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// Loads the page once before the `chromium` project so Vite's transform cache is warm: the
// spec's "within 1 second" budgets measure the page, not a cold dev server's first compile.
import { expect, test as setup } from '@playwright/test';
import { installClientsDouble } from './support/clients-double';
import { clientsPage } from './support/clients-page';

setup('warm up the dev server', async ({ page }) => {
  await installClientsDouble(page);
  await page.goto('/');
  // Loaded, whatever the content says: the warm-up proves nothing about the feature.
  await expect(clientsPage(page).grid).toHaveAttribute('aria-busy', 'false');
});
