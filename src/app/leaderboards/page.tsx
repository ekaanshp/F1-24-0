// =============================================================================
// Leaderboards Page — /leaderboards
// =============================================================================

import type { Metadata } from 'next';
import type { LeaderboardRow } from '@/types';
import { getTopScores } from '@/services/leaderboard';
import LeaderboardClient from '@/components/LeaderboardClient';

export const metadata: Metadata = {
  title: 'Leaderboard — F1 TeamBuilder',
  description: 'See the top F1 TeamBuilder scores from players around the world.',
};

export const revalidate = 30; // Revalidate every 30 seconds

export default async function LeaderboardsPage() {
  let allScores: LeaderboardRow[] = [];
  let regularScores: LeaderboardRow[] = [];
  let hardcoreScores: LeaderboardRow[] = [];

  try {
    [allScores, regularScores, hardcoreScores] = await Promise.all([
      getTopScores(50),
      getTopScores(50, 'regular'),
      getTopScores(50, 'hardcore'),
    ]);
  } catch {
    // Gracefully handle if table doesn't exist yet
  }

  return (
    <main>
      <LeaderboardClient
        allScores={allScores}
        regularScores={regularScores}
        hardcoreScores={hardcoreScores}
      />
    </main>
  );
}
