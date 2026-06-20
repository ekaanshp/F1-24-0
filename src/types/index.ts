// =============================================================================
// Shared TypeScript Types — F1 TeamBuilder
// =============================================================================

/** Game mode — determines whether stats are visible during the draft */
export type GameMode = 'regular' | 'hardcore';

/** The 8 team component slot identifiers */
export type DraftSlot =
  | 'driver1'
  | 'driver2'
  | 'chassis'
  | 'engine'
  | 'team_principal'
  | 'car_designer'
  | 'lead_engineer1'
  | 'lead_engineer2';

/** Metadata about each draft slot (display name, role mapping) */
export interface SlotMeta {
  slot: DraftSlot;
  label: string;
  role: string;
  icon: string;
}

/** A single option returned by the server during a spin */
export interface ComponentOption {
  componentName: string;
  team: string | null;
  decade: string;
  wins: number;
  poles: number;
  points: number;
  displayName?: string;
}

/** A component that has been selected for a roster slot */
export interface DraftSelection {
  slot: DraftSlot;
  componentName: string;
  team: string | null;
  decade: string;
  wins: number;
  poles: number;
  points: number;
  displayName?: string;
}

/** The full roster state tracked in React */
export type RosterState = Partial<Record<DraftSlot, DraftSelection>>;

/** Leaderboard entry as displayed in the UI */
export interface LeaderboardRow {
  rank: number;
  playerName: string;
  totalPoints: number;
  decade: string;
  gameMode: GameMode;
  createdAt: string;
  driver1: string;
  driver2: string;
  chassis: string;
  engine: string;
  teamPrincipal: string;
  carDesigner: string;
  leadEngineer1: string;
  leadEngineer2: string;
}

/** Payload sent to submitFinalScore server action */
export interface SubmitPayload {
  playerName: string;
  gameMode: GameMode;
  selections: Array<{
    slot: DraftSlot;
    componentName: string;
    decade: string;
    displayName?: string;
  }>;
}

/** Response from submitFinalScore */
export interface SubmitResult {
  success: boolean;
  totalPoints?: number;
  rank?: number;
  error?: string;
}

/** A group of options for a single role, returned by getAllPoolsForTeam */
export interface GroupedOption {
  role: string;
  label: string;
  icon: string;
  availableSlots: DraftSlot[];
  options: ComponentOption[];
}

/** Component option paired with the role it fills */
export interface SelectionWithRole {
  option: ComponentOption;
  role: string;
  targetSlot: DraftSlot;
}
