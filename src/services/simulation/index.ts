export interface RosterComponent {
  slot: string;
  componentName: string;
  team: string | null;
  rating: number;
  source: string;
}

export interface RaceResult {
  raceNumber: number;
  position: number;
  points: number;
}

export interface SeasonSimulation {
  totalPoints: number;
  totalWins: number;
  isPerfectSeason: boolean;
  races: RaceResult[];
  winProbability: number;
  rosterScore: number;
  rosterGrade: string;
}

const ROLE_WEIGHTS: Record<string, number> = {
  driver1: 0.18,
  driver2: 0.18,
  chassis: 0.18,
  engine: 0.18,
  team_principal: 0.10,
  car_designer: 0.10,
  lead_engineer1: 0.04,
  lead_engineer2: 0.04,
};

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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Scales non-driver ratings on-the-fly to match the driver ratings' baseline scale.
 * 30 (min) -> 55
 * 50 (avg) -> 80
 * 99 (max) -> 99
 */
export const scaleNonDriverRating = (rating: number): number => {
  if (rating <= 50) {
    return 55 + ((rating - 30) / 20) * 25;
  } else {
    return 80 + ((rating - 50) / 49) * 19;
  }
};

const aggregateRosterScore = (selections: RosterComponent[]) => {
  return selections.reduce((total, item) => {
    const weight = ROLE_WEIGHTS[item.slot] ?? 0.0;
    const isDriver = item.slot === 'driver1' || item.slot === 'driver2';
    const rating = isDriver ? item.rating : scaleNonDriverRating(item.rating);
    return total + rating * weight;
  }, 0);
};

const qualityToWinProbability = (quality: number) => {
  // Sigmoid S-curve: P = 1 / (1 + exp(-k * (quality - x0)))
  // k = 0.12, x0 = 66.5 (calibrated for draft ceiling around 91-92 OVR)
  const k = 0.12;
  const x0 = 66.5;
  const prob = 1.0 / (1.0 + Math.exp(-k * (quality - x0)));
  return clamp(prob, 0.01, 0.99);
};

const simulateRace = (winProbability: number) => {
  const won = Math.random() < winProbability;
  if (won) {
    return { position: 1, points: 25 };
  }
  const position = Math.floor(Math.random() * 8) + 2;
  const pointsByPosition = [18, 15, 12, 10, 8, 6, 4, 2];
  return { position, points: pointsByPosition[position - 2] ?? 0 };
};

export const simulateSeason = (selections: RosterComponent[]): SeasonSimulation => {
  const totalQuality = aggregateRosterScore(selections);
  const winProbability = qualityToWinProbability(totalQuality);

  const races: RaceResult[] = [];
  let totalPoints = 0;
  let totalWins = 0;

  for (let raceNumber = 1; raceNumber <= 24; raceNumber += 1) {
    const result = simulateRace(winProbability);
    races.push({ raceNumber, position: result.position, points: result.points });
    totalPoints += result.points;
    if (result.position === 1) totalWins += 1;
  }

  return {
    totalPoints,
    totalWins,
    isPerfectSeason: totalWins === 24,
    races,
    winProbability,
    rosterScore: Math.round(totalQuality),
    rosterGrade: getTierGrade(Math.round(totalQuality)),
  };
};
