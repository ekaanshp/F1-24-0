// =============================================================================
// Leaderboard Service — F1 TeamBuilder
// =============================================================================
// Pure database queries for the global leaderboard.
// All reads go directly to Neon PostgreSQL via Prisma — no Redis.
// =============================================================================

import { db } from '@/lib/db';
import type { GameMode, LeaderboardRow } from '@/types';

/** Fetch the top N leaderboard entries, optionally filtered by game mode. */
export const getTopScores = async (
  limit: number = 50,
  gameMode?: GameMode,
): Promise<LeaderboardRow[]> => {
  const entries = await db.leaderboardEntry.findMany({
    where: gameMode ? { gameMode } : undefined,
    orderBy: { totalPoints: 'desc' },
    take: limit,
  });

  return entries.map((entry, index) => ({
    rank: index + 1,
    playerName: entry.playerName,
    totalPoints: entry.totalPoints,
    decade: entry.decade,
    gameMode: entry.gameMode as GameMode,
    createdAt: entry.createdAt.toISOString(),
    driver1: entry.driver1,
    driver2: entry.driver2,
    chassis: entry.chassis,
    engine: entry.engine,
    teamPrincipal: entry.teamPrincipal,
    carDesigner: entry.carDesigner,
    leadEngineer1: entry.leadEngineer1,
    leadEngineer2: entry.leadEngineer2,
  }));
};

/** Get the rank position of a specific player. */
export const getPlayerRank = async (
  playerName: string,
): Promise<number | null> => {
  const player = await db.leaderboardEntry.findUnique({
    where: { playerName },
    select: { totalPoints: true },
  });

  if (!player) return null;

  // Count how many entries have a higher score
  const higherCount = await db.leaderboardEntry.count({
    where: { totalPoints: { gt: player.totalPoints } },
  });

  return higherCount + 1;
};
