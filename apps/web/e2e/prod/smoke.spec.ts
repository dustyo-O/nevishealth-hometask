import { expect, test } from '@playwright/test';
import { mockClientsOk } from '../support/mock-clients';

// Runs against `vite build && vite preview` — proves the production bundle renders the frame.
test('the production build renders the Clients page frame', async ({ page }) => {
  await mockClientsOk(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Clients chart' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Monthly detail' })).toBeVisible();
  await expect(page.getByText('12 months · Feb 2024 – Jan 2025')).toBeVisible();
  await expect(page.getByText('Company · 3 branches')).toBeVisible();
});
