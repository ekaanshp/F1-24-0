// =============================================================================
// Scoring Utilities — F1 TeamBuilder
// =============================================================================
// Pure functions for computing tier grades and aggregate roster scores.
// Used by the submitFinalScore server action (server-side only).
// =============================================================================

import { ROLE_WEIGHTS } from '@/lib/constants';
import type { DraftSlot } from '@/types';

/** Map a numeric rating (30-99) to a letter tier grade. */
export const getTierGrade = (rating: number): string => {
  if (rating >= 93) return 'S+';
  if (rating >= 85) return 'S';
  if (rating >= 80) return 'A+';
  if (rating >= 76) return 'A';
  if (rating >= 73) return 'A-';
  if (rating >= 69) return 'B+';
  if (rating >= 65) return 'B';
  if (rating >= 61) return 'B-';
  if (rating >= 56) return 'C+';
  if (rating >= 51) return 'C';
  if (rating >= 46) return 'C-';
  if (rating >= 41) return 'D+';
  if (rating >= 36) return 'D';
  return 'F';
};

/** Scales non-driver ratings to match the driver baseline scale.
 * Slightly more generous than raw — small lift to reward decent picks.
 * 30 (min) -> 57
 * 50 (avg) -> 81
 * 99 (max) -> 99
 */
export const scaleNonDriverRating = (rating: number): number => {
  if (rating <= 50) {
    return 57 + ((rating - 30) / 20) * 24;
  }
  return 81 + ((rating - 50) / 49) * 18;
};

/** Compute the aggregate roster score from 8 selected components.
 *
 * Each component's rating is weighted by its slot's role weight.
 * Non-driver ratings are scaled up to match the driver baseline.
 * A small +2 flat bonus rewards having assembled a team at all.
 */
export const aggregateRosterScore = (
  selections: Array<{ slot: DraftSlot; rating: number }>,
): number => {
  const rawScore = selections.reduce((total, item) => {
    const weight = ROLE_WEIGHTS[item.slot] ?? 0.0;
    const isDriver = item.slot === 'driver1' || item.slot === 'driver2';
    const rating = isDriver ? item.rating : scaleNonDriverRating(item.rating);
    return total + rating * weight;
  }, 0);
  return Math.min(99, rawScore + 2);
};

