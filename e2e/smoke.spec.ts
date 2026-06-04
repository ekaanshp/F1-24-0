// =============================================================================
// E2E Smoke Test — F1 TeamBuilder
// =============================================================================
// Basic smoke test to verify the app loads.
// Run with: npx playwright test
// =============================================================================

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('landing page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/F1 TeamBuilder/i);
  });

  test('auth page loads', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('draft page loads', async ({ page }) => {
    await page.goto('/draft');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('season page loads', async ({ page }) => {
    await page.goto('/season');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('leaderboards page loads', async ({ page }) => {
    await page.goto('/leaderboards');
    await expect(page.locator('h1')).toBeVisible();
  });
});
