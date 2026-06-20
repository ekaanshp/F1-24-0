// =============================================================================
// Draft Utilities — F1 TeamBuilder
// =============================================================================
// Pure query helpers used by the game server actions.
// =============================================================================

import { db } from '@/lib/db';

/** Look up the REAL rating for a component from the database.
 * Used by submitFinalScore for anti-cheat verification.
 */
export const getRealRating = async (
  decade: string,
  role: string,
  componentName: string,
): Promise<number | null> => {
  try {
    const query = `
      SELECT rating
      FROM decade_ratings
      WHERE decade = $1
        AND role = $2
        AND component_name ILIKE $3
      LIMIT 1
    `;
    const result = await db.$queryRawUnsafe<{ rating: number }[]>(
      query,
      decade,
      role,
      `%${componentName.trim()}%`
    );
    return result && result.length > 0 ? Number(result[0].rating) : null;
  } catch (err) {
    console.error('Error in getRealRating SQL:', err);
    return null;
  }
};
