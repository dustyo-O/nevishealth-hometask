import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));
// Its own port, never the developer's 5173: with `reuseExistingServer` a running dev server would be
// reused and the suite would silently test that checkout instead of this one — which is how a lane's gate
// came back green against the wrong tree (slice 6). A clash on 5273 now fails loudly instead.
const DEV_URL = 'http://localhost:5273';
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
    // Spec 002 D-15: the monthly table in Safari's engine — the one the owner's VoiceOver check
    // runs on. Every table spec, not only the sticky and scroll ones D-15 named: the first run
    // found a WebKit-only defect in opening and closing (slice 5 ledger). Opt-in
    // (`E2E_WEBKIT=1`, after `pnpm exec playwright install webkit`): CI installs Chromium only.
    ...(process.env.E2E_WEBKIT
      ? [
          {
            name: 'webkit',
            dependencies: ['setup'],
            testMatch: /table-.*\.spec\.ts$/,
            use: { ...devices['Desktop Safari'], baseURL: DEV_URL },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: 'pnpm exec vite --port 5273 --strictPort',
      cwd: appDir,
      url: DEV_URL,
      reuseExistingServer: false,
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
