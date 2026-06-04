// =============================================================================
// Shared Constants — F1 TeamBuilder
// =============================================================================

/** The 8 team component slots that must be filled during the draft */
export const TEAM_SLOTS = [
  'driver1',
  'driver2',
  'chassis',
  'pitCrew',
  'engine',
  'teamPrincipal',
  'chiefEngineer',
  'wildcard', // Aero / Special component
] as const;

/** Total number of spins in a draft session (one per slot) */
export const TOTAL_SPINS = TEAM_SLOTS.length; // 8

/** Total races in a season */
export const TOTAL_RACES = 24;

/** The ultimate goal: win all races */
export const PERFECT_SEASON_WINS = TOTAL_RACES; // 24-0

/** Draft session status values */
export const DRAFT_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
} as const;
