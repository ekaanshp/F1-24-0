'use server';

// =============================================================================
// Game Server Actions — F1 TeamBuilder
// =============================================================================
// Handles state queries and score computation server-side.
// The client NEVER holds or submits raw ratings to prevent tampering.
// =============================================================================

import { db } from '@/lib/db';
import { DRAFT_SLOTS, SLOT_META, PLAYER_NAME_REGEX } from '@/lib/constants';
import { getRealRating } from '@/services/draft';
import { aggregateRosterScore } from '@/services/simulation';
import { getPlayerRank } from '@/services/leaderboard';
import type {
  ComponentOption,
  DraftSlot,
  SubmitPayload,
  SubmitResult,
  GroupedOption,
} from '@/types';

interface DBStatRow {
  raw_id?: string | null;
  name?: string | null;
  component_name?: string | null;
  wins?: number | bigint | string | null;
  poles?: number | bigint | string | null;
  points?: number | string | null;
}

// ---------------------------------------------------------------------------
// 1. spinForSlot — Random era + team per spin
// ---------------------------------------------------------------------------

/**
 * Picks a random decade and a random team (constructor) that raced during
 * that decade. Called each time the user clicks SPIN on a slot.
 */
export async function spinForSlot(): Promise<{ decade: string; team: string; error?: string }> {
  try {
    const decades = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
    const decade = decades[Math.floor(Math.random() * decades.length)];
    const startYear = parseInt(decade.substring(0, 4), 10);
    const endYear = startYear + 9;

    const teams = await db.constructor_seasons_with_engines.findMany({
      where: {
        year: {
          gte: BigInt(startYear),
          lte: BigInt(endYear),
        },
        team_name: {
          not: null,
        },
      },
      select: {
        team_name: true,
      },
      distinct: ['team_name'],
    });

    if (teams.length === 0) {
      return { decade: '1990s', team: 'McLaren' };
    }

    const randomTeam = teams[Math.floor(Math.random() * teams.length)].team_name!;
    return { decade, team: randomTeam };
  } catch {
    return { decade: '1990s', team: 'McLaren', error: 'Failed to spin' };
  }
}

// ---------------------------------------------------------------------------
// 2. respinTeam — Keep era, re-roll team
// ---------------------------------------------------------------------------

/**
 * Lifeline: keeps the same decade but picks a different random team.
 */
export async function respinTeam(
  currentDecade: string,
  currentTeam: string,
): Promise<{ decade: string; team: string; error?: string }> {
  try {
    if (!/^\d{4}s$/.test(currentDecade)) {
      return { decade: '1990s', team: 'McLaren', error: 'Invalid decade format' };
    }

    const startYear = parseInt(currentDecade.substring(0, 4), 10);
    const endYear = startYear + 9;

    const teams = await db.constructor_seasons_with_engines.findMany({
      where: {
        year: {
          gte: BigInt(startYear),
          lte: BigInt(endYear),
        },
        team_name: {
          not: null,
        },
      },
      select: {
        team_name: true,
      },
      distinct: ['team_name'],
    });

    // Filter out the current team
    const otherTeams = teams.filter((t) => t.team_name !== currentTeam);

    if (otherTeams.length === 0) {
      // Only one team in this decade — keep it
      return { decade: currentDecade, team: currentTeam };
    }

    const randomTeam = otherTeams[Math.floor(Math.random() * otherTeams.length)].team_name!;
    return { decade: currentDecade, team: randomTeam };
  } catch {
    return { decade: currentDecade, team: currentTeam, error: 'Failed to respin team' };
  }
}

// ---------------------------------------------------------------------------
// 3. getRandomPool (legacy — kept for compatibility)
// ---------------------------------------------------------------------------

export async function getRandomPool(
  slotName: DraftSlot,
  decade: string,
  team: string,
  excludedNames: string[] = [],
): Promise<{ options: ComponentOption[]; error?: string }> {
  try {
    const meta = SLOT_META[slotName];
    if (!meta) {
      return { options: [], error: 'Invalid slot name' };
    }
    const result = await fetchOptionsForRole(meta.role, decade, team, excludedNames);
    return result;
  } catch (err) {
    console.error('Error fetching options:', err);
    return { options: [], error: 'Failed to fetch options' };
  }
}

// ---------------------------------------------------------------------------
// 3b. getAllPoolsForTeam — Fetch all role options for a landed team
// ---------------------------------------------------------------------------

/**
 * After a spin lands on a decade+team, fetch ALL available components
 * for every unfilled role. Returns options grouped by slot type.
 */
export async function getAllPoolsForTeam(
  decade: string,
  team: string,
  filledSlots: DraftSlot[],
  excludedNames: string[] = [],
): Promise<{ groups: GroupedOption[]; error?: string }> {
  try {
    if (!/^\d{4}s$/.test(decade)) {
      return { groups: [], error: 'Invalid decade format' };
    }

    const safeExcluded = Array.isArray(excludedNames)
      ? excludedNames.filter((n): n is string => typeof n === 'string')
      : [];
    const safeFilledSlots = new Set(Array.isArray(filledSlots) ? filledSlots : []);

    // Determine which roles still need filling
    const neededSlots = DRAFT_SLOTS.filter((s) => !safeFilledSlots.has(s));
    // Deduplicate by role (e.g. driver1 and driver2 both need 'driver')
    const neededRoles = [...new Set(neededSlots.map((s) => SLOT_META[s].role))];

    const groups: GroupedOption[] = [];

    for (const role of neededRoles) {
      const slotMeta = Object.values(SLOT_META).find((m) => m.role === role);
      if (!slotMeta) continue;

      // Determine how many slots of this role are still open
      const openSlotsForRole = neededSlots.filter((s) => SLOT_META[s].role === role);

      const result = await fetchOptionsForRole(role, decade, team, safeExcluded);
      if (result.options.length > 0) {
        groups.push({
          role,
          label: slotMeta.label.replace(/ \d$/, ''), // Strip trailing number
          icon: slotMeta.icon,
          availableSlots: openSlotsForRole,
          options: result.options,
        });
      }
    }

    return { groups };
  } catch (err) {
    console.error('Error fetching all pools:', err);
    return { groups: [], error: 'Failed to fetch options' };
  }
}

// ---------------------------------------------------------------------------
// Internal: fetchOptionsForRole
// ---------------------------------------------------------------------------

async function fetchOptionsForRole(
  role: string,
  decade: string,
  team: string,
  excludedNames: string[],
): Promise<{ options: ComponentOption[]; error?: string }> {
  try {
    if (!/^\d{4}s$/.test(decade)) {
      return { options: [], error: 'Invalid decade format' };
    }

    const startYear = parseInt(decade.substring(0, 4), 10);
    const endYear = startYear + 9;

    let rows: DBStatRow[] = [];

    if (role === 'driver') {
      rows = await db.$queryRawUnsafe<DBStatRow[]>(`
        SELECT
          MAX(driver_id) as raw_id,
          driver_name as name,
          SUM(COALESCE(race_wins, 0)) as wins,
          SUM(COALESCE(pole_positions, 0)) as poles,
          SUM(COALESCE(points, 0)) as points
        FROM driver_seasons
        WHERE CAST(year AS INTEGER) >= $1 AND CAST(year AS INTEGER) <= $2
          AND constructors LIKE $3
        GROUP BY driver_name
      `, startYear, endYear, `%${team}%`);
    } else if (role === 'chassis') {
      rows = await db.$queryRawUnsafe<DBStatRow[]>(`
        SELECT
          team_name as name,
          SUM(COALESCE(race_wins, 0)) as wins,
          SUM(COALESCE(pole_positions, 0)) as poles,
          SUM(COALESCE(points, 0)) as points
        FROM constructor_seasons_with_engines
        WHERE CAST(year AS INTEGER) >= $1 AND CAST(year AS INTEGER) <= $2
          AND team_name = $3
        GROUP BY team_name
      `, startYear, endYear, team);
    } else if (role === 'engine') {
      rows = await db.$queryRawUnsafe<DBStatRow[]>(`
        WITH team_engines AS (
          SELECT DISTINCT engine_manufacturer_name
          FROM constructor_seasons_with_engines
          WHERE CAST(year AS INTEGER) >= $1 AND CAST(year AS INTEGER) <= $2
            AND team_name = $3
            AND engine_manufacturer_name IS NOT NULL
        )
        SELECT
          c.engine_manufacturer_name as name,
          SUM(COALESCE(c.race_wins, 0)) as wins,
          SUM(COALESCE(c.pole_positions, 0)) as poles,
          SUM(COALESCE(c.points, 0)) as points
        FROM constructor_seasons_with_engines c
        JOIN team_engines te ON c.engine_manufacturer_name = te.engine_manufacturer_name
        WHERE CAST(c.year AS INTEGER) >= $1 AND CAST(c.year AS INTEGER) <= $2
        GROUP BY c.engine_manufacturer_name
      `, startYear, endYear, team);
    } else if (role === 'team_principal') {
      rows = await db.$queryRawUnsafe<DBStatRow[]>(`
        SELECT
          tp.name,
          SUM(COALESCE(cs.race_wins, 0)) as wins,
          SUM(COALESCE(cs.pole_positions, 0)) as poles,
          SUM(COALESCE(cs.points, 0)) as points
        FROM team_principals tp
        JOIN constructor_seasons_with_engines cs ON tp.year = CAST(cs.year AS INTEGER) AND tp.team = cs.team_name
        WHERE tp.year >= $1 AND tp.year <= $2
          AND tp.team = $3
        GROUP BY tp.name
      `, startYear, endYear, team);
    } else if (role === 'car_designer') {
      rows = await db.$queryRawUnsafe<DBStatRow[]>(`
        SELECT
          cd.name,
          SUM(COALESCE(cs.race_wins, 0)) as wins,
          SUM(COALESCE(cs.pole_positions, 0)) as poles,
          SUM(COALESCE(cs.points, 0)) as points
        FROM car_designers cd
        JOIN constructor_seasons_with_engines cs ON cd.year = CAST(cs.year AS INTEGER) AND cd.team = cs.team_name
        WHERE cd.year >= $1 AND cd.year <= $2
          AND cd.team = $3
        GROUP BY cd.name
      `, startYear, endYear, team);
    } else if (role === 'chief_engineer') {
      rows = await db.$queryRawUnsafe<DBStatRow[]>(`
        SELECT
          te.name,
          SUM(COALESCE(cs.race_wins, 0)) as wins,
          SUM(COALESCE(cs.pole_positions, 0)) as poles,
          SUM(COALESCE(cs.points, 0)) as points
        FROM team_engineers te
        JOIN constructor_seasons_with_engines cs ON te.year = CAST(cs.year AS INTEGER) AND te.team = cs.team_name
        WHERE te.year >= $1 AND te.year <= $2
          AND te.team = $3
        GROUP BY te.name
      `, startYear, endYear, team);
    }

    // --- FALLBACK STRATEGY ---
    if (rows.length === 0) {
      const fallbackComponents = await db.decade_ratings.findMany({
        where: {
          decade,
          role,
        },
        select: {
          component_name: true,
        },
        take: 12,
      });

      for (const fallback of fallbackComponents) {
        const name = fallback.component_name;
        let stats: DBStatRow = { wins: 0, poles: 0, points: 0 };

        if (role === 'driver') {
          const statsRes = await db.$queryRawUnsafe<DBStatRow[]>(`
            SELECT SUM(COALESCE(race_wins,0)) as wins, SUM(COALESCE(pole_positions,0)) as poles, SUM(COALESCE(points,0)) as points
            FROM driver_seasons WHERE driver_name = $1 AND CAST(year AS INTEGER) >= $2 AND CAST(year AS INTEGER) <= $3
          `, name, startYear, endYear);
          if (statsRes.length > 0) stats = statsRes[0];
        } else if (role === 'engine') {
          const statsRes = await db.$queryRawUnsafe<DBStatRow[]>(`
            SELECT SUM(COALESCE(race_wins,0)) as wins, SUM(COALESCE(pole_positions,0)) as poles, SUM(COALESCE(points,0)) as points
            FROM constructor_seasons_with_engines WHERE engine_manufacturer_name = $1 AND CAST(year AS INTEGER) >= $2 AND CAST(year AS INTEGER) <= $3
          `, name, startYear, endYear);
          if (statsRes.length > 0) stats = statsRes[0];
        } else if (role === 'chassis') {
          const statsRes = await db.$queryRawUnsafe<DBStatRow[]>(`
            SELECT SUM(COALESCE(race_wins,0)) as wins, SUM(COALESCE(pole_positions,0)) as poles, SUM(COALESCE(points,0)) as points
            FROM constructor_seasons_with_engines WHERE team_name = $1 AND CAST(year AS INTEGER) >= $2 AND CAST(year AS INTEGER) <= $3
          `, name, startYear, endYear);
          if (statsRes.length > 0) stats = statsRes[0];
        } else if (role === 'team_principal') {
          const statsRes = await db.$queryRawUnsafe<DBStatRow[]>(`
            SELECT SUM(COALESCE(cs.race_wins,0)) as wins, SUM(COALESCE(cs.pole_positions,0)) as poles, SUM(COALESCE(cs.points,0)) as points
            FROM team_principals tp
            JOIN constructor_seasons_with_engines cs ON tp.year = CAST(cs.year AS INTEGER) AND tp.team = cs.team_name
            WHERE tp.name = $1 AND tp.year >= $2 AND tp.year <= $3
          `, name, startYear, endYear);
          if (statsRes.length > 0) stats = statsRes[0];
        } else if (role === 'car_designer') {
          const statsRes = await db.$queryRawUnsafe<DBStatRow[]>(`
            SELECT SUM(COALESCE(cs.race_wins,0)) as wins, SUM(COALESCE(cs.pole_positions,0)) as poles, SUM(COALESCE(cs.points,0)) as points
            FROM car_designers cd
            JOIN constructor_seasons_with_engines cs ON cd.year = CAST(cs.year AS INTEGER) AND cd.team = cs.team_name
            WHERE cd.name = $1 AND cd.year >= $2 AND cd.year <= $3
          `, name, startYear, endYear);
          if (statsRes.length > 0) stats = statsRes[0];
        } else if (role === 'chief_engineer') {
          const statsRes = await db.$queryRawUnsafe<DBStatRow[]>(`
            SELECT SUM(COALESCE(cs.race_wins,0)) as wins, SUM(COALESCE(cs.pole_positions,0)) as poles, SUM(COALESCE(cs.points,0)) as points
            FROM team_engineers te
            JOIN constructor_seasons_with_engines cs ON te.year = CAST(cs.year AS INTEGER) AND te.team = cs.team_name
            WHERE te.name = $1 AND te.year >= $2 AND te.year <= $3
          `, name, startYear, endYear);
          if (statsRes.length > 0) stats = statsRes[0];
        }

        rows.push({
          name,
          wins: stats.wins,
          poles: stats.poles,
          points: stats.points,
        });
      }
    }

    // Format options and filter exclusions
    const options: ComponentOption[] = rows
      .map((r: DBStatRow) => {
        const componentName = r.name || r.component_name || '';
        let displayName = componentName;

        if (role === 'driver' && r.raw_id) {
          // e.g. "juan-pablo-montoya" -> "Juan Pablo Montoya"
          displayName = r.raw_id.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        } else if (role === 'team_principal' || role === 'car_designer' || role === 'chief_engineer') {
          const parts = displayName.trim().split(/\s+/);
          if (parts.length > 2) {
            displayName = `${parts[0]} ${parts[parts.length - 1]}`;
          }
        }

        return {
          componentName,
          displayName,
          team: team,
          decade: decade,
          wins: Math.max(0, typeof r.wins === 'number' ? r.wins : parseInt(String(r.wins || '0'), 10)),
          poles: Math.max(0, typeof r.poles === 'number' ? r.poles : parseInt(String(r.poles || '0'), 10)),
          points: Math.max(0, Math.round(parseFloat(String(r.points || '0')) * 10) / 10),
        };
      })
      .filter((opt) => opt.componentName.length > 0 && !excludedNames.includes(opt.componentName));

    // Dedup by name
    const uniqueOptionsMap = new Map<string, ComponentOption>();
    for (const opt of options) {
      uniqueOptionsMap.set(opt.componentName, opt);
    }
    const uniqueOptions = Array.from(uniqueOptionsMap.values());

    return { options: uniqueOptions };
  } catch (err) {
    console.error('Error fetching options for role:', role, err);
    return { options: [], error: 'Failed to fetch options' };
  }
}

// ---------------------------------------------------------------------------
// 4. calculateScore
// ---------------------------------------------------------------------------

export async function calculateScore(
  selections: Array<{ slot: DraftSlot; componentName: string; decade: string }>,
): Promise<{ totalPoints: number; error?: string }> {
  try {
    if (!Array.isArray(selections) || selections.length === 0) {
      return { totalPoints: 0, error: 'No selections provided' };
    }

    const ratedSelections: Array<{ slot: DraftSlot; rating: number }> = [];

    for (const sel of selections) {
      const meta = SLOT_META[sel.slot];
      if (!meta) continue;

      try {
        const realRating = await getRealRating(sel.decade, meta.role, sel.componentName);
        ratedSelections.push({ slot: sel.slot, rating: realRating ?? 50.0 });
      } catch (err: unknown) {
        console.error(`Error getting rating for ${sel.slot}:`, err);
        ratedSelections.push({ slot: sel.slot, rating: 50.0 });
      }
    }

    if (ratedSelections.length === 0) {
      return { totalPoints: 0, error: 'No valid selections could be rated' };
    }

    const totalPoints = Math.round(aggregateRosterScore(ratedSelections) * 100) / 100;
    return { totalPoints };
  } catch (err: unknown) {
    console.error('Error calculating score completely:', err);
    return { totalPoints: 0, error: 'Failed to calculate score' };
  }
}

// ---------------------------------------------------------------------------
// 5. checkNameAvailability
// ---------------------------------------------------------------------------

/**
 * Fired as the user types their name to check availability live.
 */
export async function checkNameAvailability(
  name: string,
): Promise<{ available: boolean; error?: string }> {
  try {
    if (typeof name !== 'string' || !PLAYER_NAME_REGEX.test(name)) {
      return { available: false, error: 'Name must be 3-20 alphanumeric characters or underscores' };
    }

    const existing = await db.leaderboardEntry.findUnique({
      where: { playerName: name },
      select: { id: true },
    });

    return { available: !existing };
  } catch {
    return { available: false, error: 'Failed to check name availability' };
  }
}

// ---------------------------------------------------------------------------
// 6. submitFinalScore
// ---------------------------------------------------------------------------

/**
 * ANTI-CHEAT: The client sends ONLY component names + their decades.
 * The server re-queries for REAL ratings and computes the score.
 */
export async function submitFinalScore(
  payload: SubmitPayload,
): Promise<SubmitResult> {
  try {
    const { playerName, gameMode, selections } = payload;

    // --- Validate player name ---
    if (typeof playerName !== 'string' || !PLAYER_NAME_REGEX.test(playerName)) {
      return { success: false, error: 'Invalid player name. Use 3-20 alphanumeric characters or underscores.' };
    }

    // --- Validate selections ---
    if (!Array.isArray(selections) || selections.length !== 8) {
      return { success: false, error: 'Exactly 8 selections are required.' };
    }

    // Ensure all 8 slots are present
    const submittedSlots = new Set(selections.map((s) => s.slot));
    for (const expectedSlot of DRAFT_SLOTS) {
      if (!submittedSlots.has(expectedSlot)) {
        return { success: false, error: `Missing selection for slot: ${expectedSlot}` };
      }
    }

    // Check for duplicate component names
    const componentNames = selections.map((s) => s.componentName);
    const uniqueNames = new Set(componentNames);
    if (uniqueNames.size !== componentNames.length) {
      return { success: false, error: 'Duplicate component selections are not allowed.' };
    }

    // --- Check name availability ---
    const existingEntry = await db.leaderboardEntry.findUnique({
      where: { playerName },
      select: { id: true },
    });
    if (existingEntry) {
      return { success: false, error: 'This name is already taken.' };
    }

    // --- Server-side score computation (anti-cheat) ---
    const ratedSelections: Array<{ slot: DraftSlot; rating: number }> = [];

    for (const sel of selections) {
      const meta = SLOT_META[sel.slot as DraftSlot];
      if (!meta) {
        return { success: false, error: `Invalid slot: ${sel.slot}` };
      }

      if (typeof sel.componentName !== 'string' || sel.componentName.length === 0) {
        return { success: false, error: 'Invalid component name.' };
      }

      // Validate decade format
      if (typeof sel.decade !== 'string' || !/^\d{4}s$/.test(sel.decade)) {
        return { success: false, error: 'Invalid decade in selection.' };
      }

      const realRating = await getRealRating(sel.decade, meta.role, sel.componentName);
      if (realRating === null) {
        return {
          success: false,
          error: `Component "${sel.componentName}" not found in ${sel.decade} for role ${meta.role}.`,
        };
      }

      ratedSelections.push({ slot: sel.slot as DraftSlot, rating: realRating });
    }

    const totalPoints = Math.round(aggregateRosterScore(ratedSelections) * 100) / 100;

    // --- Build the selection lookup ---
    const selectionMap = new Map(selections.map((s) => [s.slot, s.displayName || s.componentName]));

    // Collect unique decades for the leaderboard entry
    const uniqueDecades = [...new Set(selections.map((s) => s.decade))];
    const decadeLabel = uniqueDecades.length === 1 ? uniqueDecades[0] : 'Mixed';

    // --- Insert into database ---
    await db.leaderboardEntry.create({
      data: {
        playerName,
        totalPoints,
        decade: decadeLabel,
        gameMode: gameMode || 'regular',
        driver1:       selectionMap.get('driver1')       ?? '',
        driver2:       selectionMap.get('driver2')       ?? '',
        chassis:       selectionMap.get('chassis')       ?? '',
        engine:        selectionMap.get('engine')        ?? '',
        teamPrincipal: selectionMap.get('team_principal') ?? '',
        carDesigner:   selectionMap.get('car_designer')   ?? '',
        leadEngineer1: selectionMap.get('lead_engineer1') ?? '',
        leadEngineer2: selectionMap.get('lead_engineer2') ?? '',
      },
    });

    // --- Get the player's rank ---
    const rank = await getPlayerRank(playerName);

    return { success: true, totalPoints, rank: rank ?? undefined };
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes('Unique constraint')
        ? 'This name is already taken.'
        : 'Failed to submit score. Please try again.';
    return { success: false, error: message };
  }
}
