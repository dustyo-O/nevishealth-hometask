import { expect, test } from '@playwright/test';

// Runs against `vite build && vite preview` — proves the production bundle renders the frame.
test('the production build renders the Clients page frame', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Clients chart' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Monthly detail' })).toBeVisible();
});
