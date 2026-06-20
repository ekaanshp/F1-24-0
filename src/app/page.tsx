// =============================================================================
// Landing Page — / (Home)
// =============================================================================

import { getTopScores } from '@/services/leaderboard';
import HomeClient from '@/components/HomeClient';

export default async function HomePage() {
  // Fetch top 5 scores for the preview section
  let topScores: Array<{ playerName: string; totalPoints: number; decade: string }> = [];
  try {
    const scores = await getTopScores(5);
    topScores = scores.map((s) => ({
      playerName: s.playerName,
      totalPoints: s.totalPoints,
      decade: s.decade,
    }));
  } catch {
    // If the table doesn't exist yet, gracefully show empty
    topScores = [];
  }

  return <HomeClient topScores={topScores} />;
}
