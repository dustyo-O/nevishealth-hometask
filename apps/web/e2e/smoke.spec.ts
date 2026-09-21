import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockClientsOk } from './support/mock-clients';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 812 };

test.describe('Clients page frame', () => {
  // The page fetches on mount; without the stub the proxy target decides the state (slice 2).
  test.beforeEach(async ({ page }) => {
    await mockClientsOk(page);
  });

  test('shows the heading and the two card regions at 1440', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Clients chart' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Monthly detail' })).toBeVisible();
    await expect(page.getByText('12 months · Feb 2024 – Jan 2025')).toBeVisible();
    await expect(page.getByText('Company · 3 branches')).toBeVisible();
  });

  test('fits a 375 px viewport without horizontal scroll', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Clients chart' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Monthly detail' })).toBeVisible();
    await expect(page.getByText('Company · 3 branches')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(PHONE.width);
  });

  test('has no axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Company · 3 branches')).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
});
