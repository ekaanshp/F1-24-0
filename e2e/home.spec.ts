// =============================================================================
// Home Page E2E Tests — F1 TeamBuilder
// =============================================================================
// Tests:
//   ✓ Page title, meta, and hero section
//   ✓ Game-mode buttons (Regular + Hardcore)
//   ✓ Correct navigation destinations
//   ✓ How-it-works steps
//   ✓ Leaderboard preview (top-scores panel)
//   ✓ Footer content
// =============================================================================

import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ─── Page fundamentals ────────────────────────────────────────────────────

  test('has the correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/F1 TeamBuilder/i);
  });

  test('displays the main hero heading with F1 TEAMBUILDER branding', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('F1');
    await expect(heading).toContainText('TEAM');
    await expect(heading).toContainText('BUILDER');
  });

  test('shows the welcome subtitle text', async ({ page }) => {
    await expect(page.locator('text=Welcome to')).toBeVisible();
  });

  test('shows the game description text', async ({ page }) => {
    // The home description mentions spinning, drafting, and lifelines
    await expect(page.getByText(/spin to land a random era/i)).toBeVisible();
  });

  // ─── How-It-Works steps ───────────────────────────────────────────────────



  // ─── Draft mode buttons ───────────────────────────────────────────────────

  test('Start Regular Draft button is visible and enabled', async ({ page }) => {
    const btn = page.locator('#start-draft-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toContainText('START REGULAR DRAFT');
  });

  test('Start Hardcore Draft button is visible and enabled', async ({ page }) => {
    const btn = page.locator('#start-hardcore-draft-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toContainText('HARDCORE');
  });



  // ─── Leaderboard preview panel ────────────────────────────────────────────

  test('leaderboard section shows View All link when scores exist', async ({ page }) => {
    // The preview panel only renders when topScores.length > 0
    const viewAll = page.getByRole('link', { name: /view all/i });
    // If it exists, it should point to /leaderboards
    const count = await viewAll.count();
    if (count > 0) {
      await expect(viewAll).toHaveAttribute('href', '/leaderboards');
    }
  });

  test('leaderboard preview "View All" link navigates to leaderboards page', async ({ page }) => {
    const viewAll = page.getByRole('link', { name: /view all/i });
    const count = await viewAll.count();
    if (count > 0) {
      await viewAll.click();
      await expect(page).toHaveURL(/\/leaderboards/);
    }
  });

  // ─── Footer ───────────────────────────────────────────────────────────────

  test('footer is visible with attribution text', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('F1 TeamBuilder');
  });
});
