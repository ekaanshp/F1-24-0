// =============================================================================
// E2E Mock Helpers — F1 TeamBuilder
// =============================================================================
// Intercepts Next.js server actions at the network level so E2E tests are:
//   ① Deterministic  — same spin result every run
//   ② Fast           — no 5-second animation wait from real DB calls
//   ③ Isolated       — no dependency on a seeded database for game-flow tests
//
// IMPORTANT: Only the draft flow uses mocks. Leaderboard tests hit the real
// server (read-only data that works even when empty).
// =============================================================================

import type { Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Server Action response shapes that we intercept
// ---------------------------------------------------------------------------

/** What spinForSlot() returns */
export interface SpinResult {
  decade: string;
  team: string;
}

/** A single component option returned by getAllPoolsForTeam() */
export interface ComponentOption {
  componentName: string;
  displayName: string;
  team: string;
  decade: string;
  wins: number;
  poles: number;
  points: number;
}

/** A grouped role returned by getAllPoolsForTeam() */
export interface GroupedOption {
  role: string;
  label: string;
  icon: string;
  availableSlots: string[];
  options: ComponentOption[];
}

// ---------------------------------------------------------------------------
// Default mock data — deterministic, complete set for a full draft
// ---------------------------------------------------------------------------

export const MOCK_SPIN: SpinResult = { decade: '1990s', team: 'McLaren' };

export const MOCK_DRIVERS: ComponentOption[] = [
  { componentName: 'ayrton_senna', displayName: 'Ayrton Senna', team: 'McLaren', decade: '1990s', wins: 41, poles: 65, points: 614 },
  { componentName: 'mika_hakkinen', displayName: 'Mika Häkkinen', team: 'McLaren', decade: '1990s', wins: 20, poles: 26, points: 420 },
  { componentName: 'david_coulthard', displayName: 'David Coulthard', team: 'McLaren', decade: '1990s', wins: 13, poles: 12, points: 535 },
];

export const MOCK_CHASSIS: ComponentOption[] = [
  { componentName: 'mclaren_mp4_13', displayName: 'McLaren MP4/13', team: 'McLaren', decade: '1990s', wins: 9, poles: 15, points: 156 },
  { componentName: 'mclaren_mp4_4', displayName: 'McLaren MP4/4', team: 'McLaren', decade: '1990s', wins: 15, poles: 15, points: 199 },
  { componentName: 'mclaren_mp4_6', displayName: 'McLaren MP4/6', team: 'McLaren', decade: '1990s', wins: 8, poles: 10, points: 139 },
];

export const MOCK_ENGINES: ComponentOption[] = [
  { componentName: 'honda_v10_1990', displayName: 'Honda V10 (1990)', team: 'McLaren', decade: '1990s', wins: 8, poles: 10, points: 139 },
  { componentName: 'mercedes_v10_1998', displayName: 'Mercedes V10 (1998)', team: 'McLaren', decade: '1990s', wins: 9, poles: 15, points: 156 },
  { componentName: 'tag_porsche_v6', displayName: 'TAG Porsche V6', team: 'McLaren', decade: '1990s', wins: 4, poles: 6, points: 90 },
];

export const MOCK_PRINCIPALS: ComponentOption[] = [
  { componentName: 'ron_dennis', displayName: 'Ron Dennis', team: 'McLaren', decade: '1990s', wins: 50, poles: 80, points: 1200 },
  { componentName: 'tyler_alexander', displayName: 'Tyler Alexander', team: 'McLaren', decade: '1990s', wins: 10, poles: 15, points: 300 },
  { componentName: 'jo_ramirez', displayName: 'Jo Ramírez', team: 'McLaren', decade: '1990s', wins: 8, poles: 12, points: 250 },
];

export const MOCK_DESIGNERS: ComponentOption[] = [
  { componentName: 'gordon_murray', displayName: 'Gordon Murray', team: 'McLaren', decade: '1990s', wins: 15, poles: 15, points: 199 },
  { componentName: 'neil_oatley', displayName: 'Neil Oatley', team: 'McLaren', decade: '1990s', wins: 9, poles: 15, points: 156 },
  { componentName: 'steve_nichols', displayName: 'Steve Nichols', team: 'McLaren', decade: '1990s', wins: 5, poles: 8, points: 100 },
];

export const MOCK_ENGINEERS: ComponentOption[] = [
  { componentName: 'steve_hallam', displayName: 'Steve Hallam', team: 'McLaren', decade: '1990s', wins: 9, poles: 15, points: 156 },
  { componentName: 'pat_fry', displayName: 'Pat Fry', team: 'McLaren', decade: '1990s', wins: 6, poles: 9, points: 120 },
  { componentName: 'andy_cowell', displayName: 'Andy Cowell', team: 'McLaren', decade: '1990s', wins: 4, poles: 6, points: 90 },
];

/** Build the full grouped options response returned by getAllPoolsForTeam() */
export function buildMockGroups(filledSlots: string[] = []): GroupedOption[] {
  const groups: GroupedOption[] = [];

  const driverSlots = ['driver1', 'driver2'].filter((s) => !filledSlots.includes(s));
  if (driverSlots.length > 0) {
    groups.push({ role: 'driver', label: 'Drivers', icon: '🏎️', availableSlots: driverSlots, options: MOCK_DRIVERS });
  }

  if (!filledSlots.includes('chassis')) {
    groups.push({ role: 'chassis', label: 'Chassis', icon: '🔧', availableSlots: ['chassis'], options: MOCK_CHASSIS });
  }

  if (!filledSlots.includes('engine')) {
    groups.push({ role: 'engine', label: 'Engine', icon: '⚡', availableSlots: ['engine'], options: MOCK_ENGINES });
  }

  if (!filledSlots.includes('team_principal')) {
    groups.push({ role: 'team_principal', label: 'Team Principal', icon: '👔', availableSlots: ['team_principal'], options: MOCK_PRINCIPALS });
  }

  if (!filledSlots.includes('car_designer')) {
    groups.push({ role: 'car_designer', label: 'Car Designer', icon: '📐', availableSlots: ['car_designer'], options: MOCK_DESIGNERS });
  }

  const engineerSlots = ['lead_engineer1', 'lead_engineer2'].filter((s) => !filledSlots.includes(s));
  if (engineerSlots.length > 0) {
    groups.push({ role: 'chief_engineer', label: 'Lead Engineers', icon: '🛠️', availableSlots: engineerSlots, options: MOCK_ENGINEERS });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Route interceptors — patch Next.js server action POST calls
// ---------------------------------------------------------------------------

/**
 * Intercepts the spinForSlot() server action and returns MOCK_SPIN instantly.
 * Next.js server actions POST to the current page URL with the action ID.
 * We match by checking the request body contains the action name.
 */
export async function mockSpinForSlot(page: Page, spin: SpinResult = MOCK_SPIN): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = request.postData() ?? '';
    if (body.includes('spinForSlot') || body.includes('spin_for_slot')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/x-component',
        // Next.js server action format — we return a simple JSON value
        body: JSON.stringify([null, spin]),
      });
      return;
    }
    await route.fallback();
  });
}

/**
 * Intercepts getAllPoolsForTeam() and returns deterministic grouped options.
 */
export async function mockGetAllPoolsForTeam(page: Page, filledSlots: string[] = []): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = request.postData() ?? '';
    if (body.includes('getAllPoolsForTeam') || body.includes('get_all_pools_for_team')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/x-component',
        body: JSON.stringify([null, { groups: buildMockGroups(filledSlots), error: null }]),
      });
      return;
    }
    await route.fallback();
  });
}

/**
 * Intercepts calculateScore() and returns a deterministic high score.
 */
export async function mockCalculateScore(page: Page, score = 91.5): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = request.postData() ?? '';
    if (body.includes('calculateScore') || body.includes('calculate_score')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/x-component',
        body: JSON.stringify([null, { totalPoints: score }]),
      });
      return;
    }
    await route.fallback();
  });
}

/**
 * Intercepts checkNameAvailability() and returns available=true.
 */
export async function mockCheckNameAvailability(page: Page, available = true): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = request.postData() ?? '';
    if (body.includes('checkNameAvailability') || body.includes('check_name_availability')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/x-component',
        body: JSON.stringify([null, { available, error: null }]),
      });
      return;
    }
    await route.fallback();
  });
}

/**
 * Intercepts submitFinalScore() and returns a successful submission.
 */
export async function mockSubmitFinalScore(page: Page, rank = 42): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = request.postData() ?? '';
    if (body.includes('submitFinalScore') || body.includes('submit_final_score')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/x-component',
        body: JSON.stringify([null, { success: true, totalPoints: 91.5, rank, error: null }]),
      });
      return;
    }
    await route.fallback();
  });
}

/**
 * Set up ALL server action mocks for a full draft flow test.
 */
export async function mockAllDraftActions(page: Page): Promise<void> {
  await mockSpinForSlot(page);
  await mockGetAllPoolsForTeam(page);
  await mockCalculateScore(page);
  await mockCheckNameAvailability(page);
  await mockSubmitFinalScore(page);
}
