import { simulate } from './engine';
import type { LoanInput, SimulationResult, Strategies } from './types';

export interface Recommendation {
  best: SimulationResult;
  scenarios: SimulationResult[];
}

export function recommend(input: LoanInput, strategiesList: Strategies[]): Recommendation {
  const scenarios = strategiesList.map((s) => simulate(input, s));
  scenarios.sort(
    (a, b) =>
      a.metrics.totalPago - b.metrics.totalPago ||
      a.metrics.saldoZeroAt - b.metrics.saldoZeroAt
  );
  return { best: scenarios[0], scenarios };
}
