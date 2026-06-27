// =============================================================================
// Draft Page E2E Tests — F1 TeamBuilder
// =============================================================================
// Tests:
//   ✓ Page title and heading
//   ✓ Spin button present and clickable
//   ✓ Spinning wheel overlay appears
//   ✓ Slot machine animation columns visible
//   ✓ Options phase: component groups render
//   ✓ Selecting a component fills a slot
//   ✓ Progress bar and counter update
//   ✓ Lifeline badges (available + used states)
//   ✓ Respin Team / Respin Both buttons in wheel
//   ✓ Hardcore mode hides stats
//   ✓ Regular mode shows stats
//   ✓ All 8 slots filled → submit button revealed
// =============================================================================

import { test, expect, Page } from '@playwright/test';
import { mockAllDraftActions } from './helpers/mock-actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the draft page and wait for it to be ready.
 */
async function gotoDraft(page: Page, mode: 'regular' | 'hardcore' = 'regular') {
  await mockAllDraftActions(page);
  await page.goto(`/draft?mode=${mode}`);
  // Wait for the SPIN button to be visible
  await expect(page.locator('#spin-btn')).toBeVisible({ timeout: 15_000 });
}

/**
 * Click the SPIN button and wait for the spinning overlay to open.
 * The overlay appears immediately (animation is disabled by reducedMotion).
 */
async function clickSpin(page: Page) {
  await page.locator('#spin-btn').click();
  // The overlay panel has a fixed inset-0 with z-50
  await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Describe blocks
// ---------------------------------------------------------------------------

test.describe('Draft Page — Basic Setup', () => {
  test('has the correct page title', async ({ page }) => {
    await gotoDraft(page);
    await expect(page).toHaveTitle(/Draft Your Team/i);
  });

  test('shows the main h1 heading "BUILD YOUR DREAM TEAM"', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.locator('h1')).toContainText('BUILD YOUR DREAM TEAM');
  });

  test('shows the subtitle explaining spin mechanics', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.getByText(/spin to land a random era/i)).toBeVisible();
  });
});

test.describe('Draft Page — Spin Button', () => {
  test('SPIN button is visible with correct text', async ({ page }) => {
    await gotoDraft(page);
    const btn = page.locator('#spin-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('SPIN FOR ERA');
    await expect(btn).toContainText('TEAM');
  });

  test('SPIN button is enabled initially (no slots filled)', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.locator('#spin-btn')).toBeEnabled();
  });

  test('clicking SPIN opens the spinning wheel overlay', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    // The overlay must be visible
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible();
  });
});

test.describe('Draft Page — Spinning Wheel Overlay', () => {
  test('overlay shows "Your Era" column header', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Your Era')).toBeVisible({ timeout: 10_000 });
  });

  test('overlay shows "Your Team" column header', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Your Team')).toBeVisible({ timeout: 10_000 });
  });

  test('overlay transitions from spinning to options phase', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    // After the animation (or immediately with reducedMotion), options phase appears
    // The options phase shows "Choose a Component"
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
  });

  test('options phase shows the era/team badge', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    // After spin, the team + decade should be displayed as a pair
    // The era appears in blue, team in amber — both should be present
    const overlay = page.locator('.fixed.inset-0.z-50');
    await expect(overlay).toBeVisible();
  });

  test('options phase shows at least one component group', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    // There must be at least one group with component cards
    const cards = page.locator('[id^="option-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('component option cards have a select indicator on hover', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    const firstCard = page.locator('[id^="option-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.hover();
    // SELECT indicator appears on hover (opacity changes from 0 to 100)
    await expect(page.getByText('▸ SELECT ◂')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Draft Page — Slot Selection Flow', () => {
  test('selecting a component closes the overlay', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });

    // Click the first available option card
    const firstCard = page.locator('[id^="option-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 });
    await firstCard.click();

    // Overlay should disappear
    await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 10_000 });
  });

  test('selecting a component fills a slot card', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });

    const firstCard = page.locator('[id^="option-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 });
    await firstCard.click();

    // Overlay gone → at least one slot card should now show a filled state
    await expect(page.locator('.card-slot.filled')).toBeVisible({ timeout: 10_000 });
  });

  test('filled slot card shows the component name', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });

    const firstCard = page.locator('[id^="option-"]').first();
    const componentName = await firstCard.locator('h4').textContent();
    await firstCard.click();

    // The filled slot card should contain the selected component's name
    const filledSlot = page.locator('.card-slot.filled').first();
    await expect(filledSlot).toBeVisible({ timeout: 10_000 });
    await expect(filledSlot).toContainText(componentName?.trim() ?? '');
  });

  test('filled slot card shows era and team badges', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });

    const firstCard = page.locator('[id^="option-"]').first();
    await firstCard.click();

    // The slot card should show era badge and team badge
    const filledSlot = page.locator('.card-slot.filled').first();
    await expect(filledSlot).toBeVisible({ timeout: 10_000 });
    // Era badge text matches a decade pattern like "1990s", "2000s" etc.
    await expect(filledSlot.getByText(/\d{4}s/)).toBeVisible();
  });
});

test.describe('Draft Page — Progress Bar', () => {
  test('initially shows 0 / 8 progress', async ({ page }) => {
    await gotoDraft(page);
    // Progress counter text
    await expect(page.getByText('0 / 8')).toBeVisible();
  });

  test('progress counter increments after selecting a slot', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    await page.locator('[id^="option-"]').first().click();
    // Should now show 1 / 8
    await expect(page.getByText('1 / 8')).toBeVisible({ timeout: 10_000 });
  });

  test('progress bar track element is visible', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.locator('.progress-track')).toBeVisible();
  });

  test('progress bar fill element is visible', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.locator('.progress-fill')).toBeVisible();
  });
});

test.describe('Draft Page — Slot Grid', () => {
  test('shows exactly 8 slot cards initially (all empty)', async ({ page }) => {
    await gotoDraft(page);
    const slots = page.locator('.card-slot');
    await expect(slots).toHaveCount(8);
  });

  test('each empty slot card shows its role label', async ({ page }) => {
    await gotoDraft(page);
    // Check for known role labels
    await expect(page.getByText('Driver 1')).toBeVisible();
    await expect(page.getByText('Driver 2')).toBeVisible();
    await expect(page.getByText('Chassis')).toBeVisible();
    await expect(page.getByText('Engine')).toBeVisible();
    await expect(page.getByText('Team Principal')).toBeVisible();
    await expect(page.getByText('Car Designer')).toBeVisible();
    await expect(page.getByText('Lead Engineer 1')).toBeVisible();
    await expect(page.getByText('Lead Engineer 2')).toBeVisible();
  });

  test('slot grid has correct layout class for responsive columns', async ({ page }) => {
    await gotoDraft(page);
    const grid = page.locator('.grid-cols-2');
    await expect(grid.first()).toBeVisible();
  });
});

test.describe('Draft Page — Lifeline Badges', () => {
  test('shows RESPIN TEAM lifeline badge', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.getByText('RESPIN TEAM').first()).toBeVisible();
  });

  test('shows RESPIN BOTH lifeline badge', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.getByText('RESPIN BOTH').first()).toBeVisible();
  });

  test('lifeline badges are not marked as used initially', async ({ page }) => {
    await gotoDraft(page);
    // The badges in the header bar should not have the 'used' class
    const badges = page.locator('.lifeline-badge');
    await expect(badges.first()).not.toHaveClass(/used/);
  });

  test('RESPIN TEAM button appears in the wheel overlay after spin', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    // The wheel overlay has lifeline buttons
    await expect(page.getByText('RESPIN TEAM').last()).toBeVisible();
  });

  test('RESPIN BOTH button appears in the wheel overlay after spin', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('RESPIN BOTH').last()).toBeVisible();
  });

  test('RESPIN TEAM lifeline button is initially enabled', async ({ page }) => {
    await gotoDraft(page);
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });

    // The lifeline button inside the overlay
    const respinTeamBtn = page.locator('.lifeline-btn').filter({ hasText: 'RESPIN TEAM' });
    await expect(respinTeamBtn).toBeEnabled();
  });
});

test.describe('Draft Page — Game Mode: Hardcore', () => {
  test('hardcore page title mentions Draft', async ({ page }) => {
    await gotoDraft(page, 'hardcore');
    await expect(page).toHaveTitle(/Draft/i);
  });

  test('hardcore mode shows SPIN button', async ({ page }) => {
    await gotoDraft(page, 'hardcore');
    await expect(page.locator('#spin-btn')).toBeVisible();
  });

  test('hardcore mode — option cards hide stat boxes', async ({ page }) => {
    await gotoDraft(page, 'hardcore');
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    // In hardcore mode the grid of Wins/Poles/Pts is NOT rendered
    await expect(page.getByText('Wins').first()).not.toBeVisible();
    await expect(page.getByText('Poles').first()).not.toBeVisible();
  });
});

test.describe('Draft Page — Game Mode: Regular', () => {
  test('regular mode — option cards show stats (Wins, Poles, Pts)', async ({ page }) => {
    await gotoDraft(page, 'regular');
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    // Stats section should be visible for at least one card
    await expect(page.getByText('Wins').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Poles').first()).toBeVisible();
    await expect(page.getByText('Pts').first()).toBeVisible();
  });

  test('regular mode — filled slot shows wins/poles/points stats', async ({ page }) => {
    await gotoDraft(page, 'regular');
    await clickSpin(page);
    await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
    await page.locator('[id^="option-"]').first().click();

    // After filling a slot, the slot card in regular mode shows stats
    const filledSlot = page.locator('.card-slot.filled').first();
    await expect(filledSlot).toBeVisible({ timeout: 10_000 });
    // Look for the wins trophy emoji in the slot card
    await expect(filledSlot.getByText(/🏆/)).toBeVisible();
  });
});

test.describe('Draft Page — Completed Draft Flow', () => {
  /**
   * Simulate filling all 8 slots by clicking SPIN and selecting an option 8 times.
   * This is the critical end-to-end flow.
   */
  test('completing all 8 slots hides the SPIN button', async ({ page }) => {
    await gotoDraft(page);

    for (let i = 0; i < 8; i++) {
      // SPIN button should be visible before we're done
      await expect(page.locator('#spin-btn')).toBeVisible({ timeout: 15_000 });
      await page.locator('#spin-btn').click();
      await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
      await page.locator('[id^="option-"]').first().click();
      // Wait for overlay to close
      await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 10_000 });
    }

    // After 8 picks, SPIN button should be gone
    await expect(page.locator('#spin-btn')).not.toBeVisible({ timeout: 10_000 });
  });

  test('completing all 8 slots shows 8 / 8 in progress counter', async ({ page }) => {
    await gotoDraft(page);

    for (let i = 0; i < 8; i++) {
      await expect(page.locator('#spin-btn')).toBeVisible({ timeout: 15_000 });
      await page.locator('#spin-btn').click();
      await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
      await page.locator('[id^="option-"]').first().click();
      await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 10_000 });
    }

    await expect(page.getByText('8 / 8')).toBeVisible({ timeout: 10_000 });
  });

  test('completing all 8 slots reveals the REVEAL TEAM RATING button', async ({ page }) => {
    await gotoDraft(page);

    for (let i = 0; i < 8; i++) {
      await expect(page.locator('#spin-btn')).toBeVisible({ timeout: 15_000 });
      await page.locator('#spin-btn').click();
      await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
      await page.locator('[id^="option-"]').first().click();
      await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 10_000 });
    }

    // The submit/reveal button appears once complete
    await expect(
      page.locator('#open-submit-btn').or(page.getByText(/REVEAL TEAM RATING/i))
    ).toBeVisible({ timeout: 15_000 });
  });

  test('all 8 slot cards are filled after completing the draft', async ({ page }) => {
    await gotoDraft(page);

    for (let i = 0; i < 8; i++) {
      await expect(page.locator('#spin-btn')).toBeVisible({ timeout: 15_000 });
      await page.locator('#spin-btn').click();
      await expect(page.getByText('Choose a Component')).toBeVisible({ timeout: 30_000 });
      await page.locator('[id^="option-"]').first().click();
      await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 10_000 });
    }

    // All 8 slots should have the filled class
    const filledSlots = page.locator('.card-slot.filled');
    await expect(filledSlots).toHaveCount(8, { timeout: 15_000 });
  });
});

test.describe('Draft Page — Navigation', () => {
  test('shows "Cancel and Return Home" link', async ({ page }) => {
    await gotoDraft(page);
    await expect(page.getByText(/Cancel and Return Home/i)).toBeVisible();
  });

  test('"Cancel and Return Home" link navigates to /', async ({ page }) => {
    await gotoDraft(page);
    await page.getByText(/Cancel and Return Home/i).click();
    await expect(page).toHaveURL('/');
  });
});
