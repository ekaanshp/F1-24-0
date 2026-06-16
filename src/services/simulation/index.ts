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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const aggregateRosterScore = (selections: RosterComponent[]) => {
  return selections.reduce((total, item) => {
    const weight = ROLE_WEIGHTS[item.slot] ?? 0.0;
    return total + item.rating * weight;
  }, 0);
};

const qualityToWinProbability = (quality: number) => {
  const normalized = clamp((quality - 50) / 50, -1, 1);
  return clamp(0.40 + normalized * 0.25, 0.05, 0.95);
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
  };
};
