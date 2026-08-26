import type { LoanInput, SimulationResult, Strategies } from './types';

export function convertAnnualToMonthly(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function pmt(monthlyRate: number, months: number, principal: number): number {
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function irrMonthly(cashFlows: number[]): number {
  const f = (r: number) => cashFlows.reduce((acc, c, i) => acc + c / Math.pow(1 + r, i), 0);
  let lo = 0, hi = 10; // f(0) > 0 (recebe mais que o principal) e f decresce com r
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function simulate(_input: LoanInput, _strategies: Strategies = emptyStrategies()): SimulationResult {
  throw new Error('implementado no Task 3');
}

function emptyStrategies(): Strategies {
  return { extraLumpSum: [], reduceMode: 'term' };
}
