// =============================================================================
// Playwright Configuration — F1 TeamBuilder
// =============================================================================
// End-to-end testing configuration.
//
// Local:  npx playwright test              (reuses existing dev server)
// Local:  npx playwright test --ui         (interactive mode)
// CI:     npx playwright test              (builds + starts prod server)
//
// Browsers: Chromium (all envs) + Firefox + WebKit (CI only)
// =============================================================================

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Run test files in parallel; tests within a single file run serially
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests twice on CI, never locally
  retries: process.env.CI ? 2 : 0,

  // Parallelism: 1 worker on CI (sequential, predictable), unlimited locally
  workers: process.env.CI ? 1 : undefined,

  // Reporters: always HTML; on CI also emit GitHub annotations
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'on-failure' }], ['list']],

  use: {
    // Base URL — all page.goto('/') calls resolve here
    baseURL: 'http://localhost:4050',

    // Capture traces on first retry only (saves storage)
    trace: 'on-first-retry',

    // Capture screenshot on test failure
    screenshot: 'only-on-failure',

    // Capture video on first retry
    video: 'on-first-retry',

    // Sane defaults
    actionTimeout: 10_000,
    navigationTimeout: 30_000,

  },

  // Global per-test timeout (includes all beforeEach/afterEach hooks)
  timeout: 45_000,

  // ─── Browser Projects ──────────────────────────────────────────────────────
  projects: [
    // Always run Chromium
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // On CI also run Firefox and WebKit for cross-browser coverage
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
          // Mobile viewport
          {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
          },
        ]
      : []),
  ],

  // ─── Dev / Prod Server ─────────────────────────────────────────────────────
  webServer: {
    command: process.env.CI ? 'PORT=4050 npm run build && PORT=4050 npm run start' : 'PORT=4050 npm run dev',
    url: 'http://localhost:4050',
    reuseExistingServer: false,
    timeout: 180_000, // 3 min — build can be slow
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
