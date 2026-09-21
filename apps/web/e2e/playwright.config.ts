import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const DEV_URL = 'http://localhost:5173';
const PROD_URL = 'http://localhost:4173';
const isCI = Boolean(process.env.CI);

/**
 * Two projects (tech doc D-9): `chromium` against the Vite dev server (API mocked per test) and
 * `prod` against `vite build && vite preview` — the only honest proof that dev-only code is gone
 * from the production bundle. Never Nest: the web gate needs only Vite.
 */
export default defineConfig({
  testDir: '.',
  outputDir: fileURLToPath(new URL('../../../docs/screenshots', import.meta.url)),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // One warm-up load, so the dev project's 1-second budgets do not measure Vite's first compile.
      name: 'setup',
      testMatch: 'warm-up.setup.ts',
      use: { ...devices['Desktop Chrome'], baseURL: DEV_URL },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: ['prod/**', 'warm-up.setup.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: DEV_URL },
    },
    {
      name: 'prod',
      testMatch: 'prod/**',
      use: { ...devices['Desktop Chrome'], baseURL: PROD_URL },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev',
      cwd: appDir,
      url: DEV_URL,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort',
      cwd: appDir,
      url: PROD_URL,
      // Always a fresh build: a leftover preview would test stale code.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
