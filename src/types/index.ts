// =============================================================================
// Shared TypeScript Types — F1 TeamBuilder
// =============================================================================
// Central type definitions used across the application.
// Add your domain types here as you build each feature.
// =============================================================================

import { TEAM_SLOTS, DRAFT_STATUS } from '@/lib/constants';

/** A single team component slot name */
export type TeamSlot = (typeof TEAM_SLOTS)[number];

/** Draft session status */
export type DraftStatus = (typeof DRAFT_STATUS)[keyof typeof DRAFT_STATUS];

/** The team/era combination returned by a spin */
export interface SpinResult {
  id: string;
  era: string; // e.g., "2004"
  team: string; // e.g., "Ferrari"
  // TODO: Add available components for this team/era
}

/** A single selected component in the roster */
export interface RosterComponent {
  slot: TeamSlot;
  name: string;
  // TODO: Add rating, image, era, team, etc.
}

/** A fully assembled team roster */
export interface TeamRoster {
  id: string;
  userId: string;
  draftSessionId: string;
  components: RosterComponent[];
}

/** A single race result in the simulation */
export interface RaceResult {
  raceNumber: number; // 1–24
  trackName: string;
  position: number;
  points: number;
  // TODO: Add detailed stats (lap times, incidents, etc.)
}

/** Full season simulation output */
export interface SeasonResult {
  rosterId: string;
  totalPoints: number;
  totalWins: number;
  isPerfectSeason: boolean; // 24-0
  races: RaceResult[];
}

/** Leaderboard entry for global rankings */
export interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  totalPoints: number;
  wins: number;
  isPerfectSeason: boolean;
}
