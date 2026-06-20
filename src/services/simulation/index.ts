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
  if (rating >= 85) return 'S';
  if (rating >= 81) return 'A+';
  if (rating >= 78) return 'A';
  if (rating >= 75) return 'A-';
  if (rating >= 71) return 'B+';
  if (rating >= 67) return 'B';
  if (rating >= 63) return 'B-';
  if (rating >= 58) return 'C+';
  if (rating >= 53) return 'C';
  if (rating >= 48) return 'C-';
  if (rating >= 43) return 'D+';
  if (rating >= 38) return 'D';
  return 'D-';
};

/** Scales non-driver ratings to match the driver baseline scale.
 * 30 (min) -> 55
 * 50 (avg) -> 80
 * 99 (max) -> 99
 */
export const scaleNonDriverRating = (rating: number): number => {
  if (rating <= 50) {
    return 55 + ((rating - 30) / 20) * 25;
  }
  return 80 + ((rating - 50) / 49) * 19;
};

/** Compute the aggregate roster score from 8 selected components.
 *
 * Each component's rating is weighted by its slot's role weight.
 * Non-driver ratings are scaled up to match the driver baseline.
 */
export const aggregateRosterScore = (
  selections: Array<{ slot: DraftSlot; rating: number }>,
): number => {
  return selections.reduce((total, item) => {
    const weight = ROLE_WEIGHTS[item.slot] ?? 0.0;
    const isDriver = item.slot === 'driver1' || item.slot === 'driver2';
    const rating = isDriver ? item.rating : scaleNonDriverRating(item.rating);
    return total + rating * weight;
  }, 0);
};
