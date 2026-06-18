import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { getTierGrade, scaleNonDriverRating } from '@/services/simulation';

const DRAFT_STATE_PREFIX = 'draft:';
const DEFAULT_OPTIONS_PER_SLOT = 3;

export type DraftSlot =
  | 'driver1'
  | 'driver2'
  | 'chassis'
  | 'engine'
  | 'team_principal'
  | 'car_designer'
  | 'lead_engineer1'
  | 'lead_engineer2';

export interface ComponentOption {
  componentName: string;
  team: string | null;
  rating: number;
  source: string;
  tierGrade: string;
}

export interface DraftSelection {
  slot: DraftSlot;
  componentName: string;
  team: string | null;
  rating: number;
  source: string;
  tierGrade: string;
}

interface DraftState {
  draftId: string;
  decade: string;
  slotIndex: number;
  selections: DraftSelection[];
  options: ComponentOption[];
}

const DRAFT_SLOTS: DraftSlot[] = [
  'driver1',
  'driver2',
  'chassis',
  'engine',
  'team_principal',
  'car_designer',
  'lead_engineer1',
  'lead_engineer2',
];

const slotToRole = (slot: DraftSlot): string => {
  if (slot.startsWith('driver')) return 'driver';
  if (slot.startsWith('lead_engineer')) return 'chief_engineer';
  return slot;
};

const getDraftKey = (draftId: string) => `${DRAFT_STATE_PREFIX}${draftId}`;

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getAvailableDecade = async (): Promise<string> => {
  const decades = await db.$queryRaw<Array<{ decade: string }>>
    `SELECT DISTINCT decade FROM decade_ratings ORDER BY decade`;

  if (decades.length === 0) {
    throw new Error('No decades available in decade_ratings');
  }

  const choice = decades[Math.floor(Math.random() * decades.length)];
  return choice.decade;
};

const queryOptions = async (
  decade: string,
  role: string,
  excludedNames: string[] = [],
): Promise<ComponentOption[]> => {
  const excludedList = excludedNames.length > 0 ? excludedNames : [''];
  const rows = await db.$queryRaw<Array<{
    component_name: string;
    rating: number;
  }>>`
    SELECT component_name, rating
    FROM decade_ratings
    WHERE decade = ${decade}
      AND role = ${role}
      AND component_name NOT IN (${excludedList})
    ORDER BY rating DESC
    LIMIT 20
  `;

  const options = rows.map((row) => {
    const rawRating = Number(row.rating);
    const isDriver = role === 'driver';
    const displayRating = isDriver ? rawRating : scaleNonDriverRating(rawRating);
    return {
      componentName: row.component_name,
      team: null,
      rating: Math.round(displayRating),
      source: 'decade_ratings',
      tierGrade: getTierGrade(displayRating),
    };
  });

  return shuffle(options).slice(0, DEFAULT_OPTIONS_PER_SLOT);
};

const createDraftState = async (decade: string): Promise<DraftState> => {
  const draftId = crypto.randomUUID();
  const state: DraftState = {
    draftId,
    decade,
    slotIndex: 0,
    selections: [],
    options: [],
  };
  await redis.set(getDraftKey(draftId), JSON.stringify(state), 'EX', 60 * 60);
  return state;
};

const getDraftState = async (draftId: string): Promise<DraftState | null> => {
  const raw = await redis.get(getDraftKey(draftId));
  return raw ? (JSON.parse(raw) as DraftState) : null;
};

const saveDraftState = async (state: DraftState) => {
  await redis.set(getDraftKey(state.draftId), JSON.stringify(state), 'EX', 60 * 60);
};

export const getNextDraftSpin = async (draftId?: string) => {
  let state: DraftState | null = null;

  if (draftId) {
    state = await getDraftState(draftId);
  }

  if (!state) {
    const decade = await getAvailableDecade();
    state = await createDraftState(decade);
  }

  if (state.slotIndex >= DRAFT_SLOTS.length) {
    return state;
  }

  const currentSlot = DRAFT_SLOTS[state.slotIndex];
  const role = slotToRole(currentSlot);
  const excludedNames = state.selections.map((selection) => selection.componentName);
  const options = await queryOptions(state.decade, role, excludedNames);

  state.options = options;
  await saveDraftState(state);

  return state;
};

export const selectDraftComponent = async (
  draftId: string,
  componentName: string,
): Promise<DraftState> => {
  const state = await getDraftState(draftId);
  if (!state) {
    throw new Error('Draft session not found');
  }

  if (state.slotIndex >= DRAFT_SLOTS.length) {
    throw new Error('Draft is already complete');
  }

  const option = state.options.find((item) => item.componentName === componentName);
  if (!option) {
    throw new Error('Selected component is not valid for this spin');
  }

  const currentSlot = DRAFT_SLOTS[state.slotIndex];
  state.selections.push({
    slot: currentSlot,
    componentName: option.componentName,
    team: option.team,
    rating: option.rating,
    source: option.source,
    tierGrade: option.tierGrade,
  });
  state.slotIndex += 1;
  state.options = [];

  await saveDraftState(state);
  return state;
};

export const isDraftComplete = (state: DraftState) => state.slotIndex >= DRAFT_SLOTS.length;
