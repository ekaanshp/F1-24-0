// =============================================================================
// Shared Constants — F1 TeamBuilder
// =============================================================================

import type { DraftSlot, SlotMeta } from '@/types';

/** Ordered list of the 8 draft slots */
export const DRAFT_SLOTS: DraftSlot[] = [
  'driver1',
  'driver2',
  'chassis',
  'engine',
  'team_principal',
  'car_designer',
  'lead_engineer1',
  'lead_engineer2',
];

/** Metadata for each slot: display label, DB role, and icon emoji */
export const SLOT_META: Record<DraftSlot, SlotMeta> = {
  driver1:        { slot: 'driver1',        label: 'Driver 1',        role: 'driver',          icon: '🏎️' },
  driver2:        { slot: 'driver2',        label: 'Driver 2',        role: 'driver',          icon: '🏎️' },
  chassis:        { slot: 'chassis',        label: 'Chassis',         role: 'chassis',         icon: '🔧' },
  engine:         { slot: 'engine',         label: 'Engine',          role: 'engine',          icon: '⚡' },
  team_principal: { slot: 'team_principal', label: 'Team Principal',  role: 'team_principal',  icon: '👔' },
  car_designer:   { slot: 'car_designer',   label: 'Car Designer',    role: 'car_designer',    icon: '📐' },
  lead_engineer1: { slot: 'lead_engineer1', label: 'Lead Engineer 1', role: 'chief_engineer',  icon: '🛠️' },
  lead_engineer2: { slot: 'lead_engineer2', label: 'Lead Engineer 2', role: 'chief_engineer',  icon: '🛠️' },
};

/** Number of options displayed per spin */
export const OPTIONS_PER_SPIN = 3;

/** Weight each slot contributes to the final roster score */
export const ROLE_WEIGHTS: Record<DraftSlot, number> = {
  driver1:        0.18,
  driver2:        0.18,
  chassis:        0.18,
  engine:         0.18,
  team_principal: 0.10,
  car_designer:   0.10,
  lead_engineer1: 0.04,
  lead_engineer2: 0.04,
};

/** Available decades for the game */
export const AVAILABLE_DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'] as const;

/** Player name validation: 3-20 alphanumeric + underscore characters */
export const PLAYER_NAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
export const PLAYER_NAME_MIN_LENGTH = 3;
export const PLAYER_NAME_MAX_LENGTH = 20;
