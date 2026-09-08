import { irrMonthly, simulate } from '@/lib/finance/engine';
import { recommendSmart, type SmartCandidate, type SmartRecommendation } from '@/lib/finance/smart';
import type { SimulationResult } from '@/lib/finance/types';
import { ComparatorValidationError, validateComparator, normalizeProposal, type ComparatorValidationOptions } from './validate';
import type { ComparatorInput, ComparatorProposal, ProposalError } from './types';

export interface SmartOutcome {
  recommended: SmartRecommendation;
  feasible: boolean;
  minBudget: number;
}

export interface ProposalOutcome {
  proposal: ComparatorProposal;
  result: SimulationResult;
  cetCalculated: number;
  cetAlert: boolean;
  acquisitionCost: number;
  financingCost: number;
  costPer100k: number;
  smart?: SmartOutcome;
}

export interface ComparatorResult {
  v1: {
    fingerprintVersion: number;
    inputFingerprint: string;
    outcomes: ProposalOutcome[];
    ranked: ProposalOutcome[];
    best: ProposalOutcome | null;
    smartRanked: ProposalOutcome[];
    computedAt: string;
  };
}

export const COMPARISON_ENGINE_VERSION = '2';
export const COMPARISON_FINGERPRINT_VERSION = 1;

export function comparisonLoadVersions(storedEngineVersion: string, recalculated: boolean) {
  return {
    resultEngineVersion: recalculated ? COMPARISON_ENGINE_VERSION : storedEngineVersion,
    storedEngineVersion,
  };
}

export function rankProposalOutcomes(outcomes: ProposalOutcome[]): ProposalOutcome[] {
  return [...outcomes].sort(
    (a, b) =>
      a.acquisitionCost - b.acquisitionCost ||
      a.costPer100k - b.costPer100k ||
      b.proposal.principal - a.proposal.principal
  );
}

export function rankSmartOutcomes(outcomes: ProposalOutcome[]): ProposalOutcome[] {
  return [...outcomes].sort((a, b) => {
    const fa = a.smart?.feasible ? 0 : 1;
    const fb = b.smart?.feasible ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const ta = a.smart?.recommended.best?.result.metrics.totalPago ?? Infinity;
    const tb = b.smart?.recommended.best?.result.metrics.totalPago ?? Infinity;
    return ta - tb;
  });
}

export function comparatorInputFingerprint(input: ComparatorInput): string {
  return JSON.stringify({
    version: COMPARISON_FINGERPRINT_VERSION,
    monthlyBudget: input.monthlyBudget,
    proposals: input.proposals.map((proposal) => proposalFingerprintValue(proposal)),
  });
}

function proposalFingerprintValue(proposal: ComparatorProposal) {
  return {
    bank: proposal.bank,
    propertyValue: proposal.propertyValue,
    downPayment: proposal.downPayment,
    principal: proposal.principal,
    system: proposal.system,
    months: proposal.months,
    annualRate: proposal.annualRate,
    cetInformed: proposal.cetInformed,
    trMonthly: proposal.trMonthly,
    insuranceMonthly: proposal.insuranceMonthly,
    fees: proposal.fees.map((fee) => ({ amount: fee.amount, includeInCet: fee.includeInCet })),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function cetFromFlows(netCredit: number, installments: { parcela: number }[]): number {
  const flows = [-netCredit, ...installments.map((i) => i.parcela)];
  const m = irrMonthly(flows);
  if (!Number.isFinite(m)) return 0;
  return Math.pow(1 + m, 12) - 1;
}

function restoreResultBank(result: SimulationResult, bank: string): SimulationResult {
  return { ...result, input: { ...result.input, bank } };
}

function restoreCandidateBank(candidate: SmartCandidate, bank: string): SmartCandidate {
  return { ...candidate, result: restoreResultBank(candidate.result, bank) };
}

function restoreRecommendationBank(recommendation: SmartRecommendation, bank: string): SmartRecommendation {
  return {
    ...recommendation,
    best: recommendation.best ? restoreCandidateBank(recommendation.best, bank) : null,
    alternatives: recommendation.alternatives.map((candidate) => restoreCandidateBank(candidate, bank)),
    comparison: recommendation.comparison.map((comparison) => ({
      ...comparison,
      candidate: comparison.candidate ? restoreCandidateBank(comparison.candidate, bank) : undefined,
    })),
    modes: {
      term: recommendation.modes.term ? restoreCandidateBank(recommendation.modes.term, bank) : null,
      payment: recommendation.modes.payment ? restoreCandidateBank(recommendation.modes.payment, bank) : null,
    },
    maxTerms: recommendation.maxTerms.map((candidate) => restoreCandidateBank(candidate, bank)),
  };
}

export function computeComparator(input: ComparatorInput, options: ComparatorValidationOptions = {}): ComparatorResult {
  const errors: ProposalError[] = validateComparator(input, options);
  if (errors.length > 0) throw new ComparatorValidationError(errors[0].message);
  const normalized = input.proposals.map((p) => normalizeProposal(p as unknown as Record<string, unknown>, options));

  const outcomes: ProposalOutcome[] = normalized.map((proposal) => {
    // Registros antigos podem ter banco acima do limite atual da engine. O nome
    // original permanece no resultado; somente input interno usa marcador seguro.
    const calculationBank = options.legacy && proposal.bank.length > 60 ? 'Banco legado' : proposal.bank;
    const calculatedResult = simulate({
      system: proposal.system,
      principal: proposal.principal,
      annualRate: proposal.annualRate,
      months: proposal.months,
      trMonthly: proposal.trMonthly,
      insuranceMonthly: proposal.insuranceMonthly,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
      bank: calculationBank,
    });
    const result = restoreResultBank(calculatedResult, proposal.bank);
    const cetFees = proposal.fees.filter((f) => f.includeInCet).reduce((s, f) => s + f.amount, 0);
    const cetCalculated = cetFromFlows(proposal.principal - cetFees, result.installments);
    const feesTotal = proposal.fees.reduce((s, f) => s + f.amount, 0);
    const financingCost = result.metrics.totalPago + feesTotal;
    const calculatedSmartRec = recommendSmart({
      principal: proposal.principal,
      annualRate: proposal.annualRate,
      trMonthly: proposal.trMonthly,
      insuranceMonthly: proposal.insuranceMonthly,
      bank: calculationBank,
      maxMonths: proposal.months,
      maxPayment: input.monthlyBudget,
      fixedUntilMonth: undefined,
    });
    const smartRec = restoreRecommendationBank(calculatedSmartRec, proposal.bank);
    return {
      proposal,
      result,
      cetCalculated,
      cetAlert: round2(proposal.cetInformed) !== round2(cetCalculated),
      acquisitionCost: proposal.downPayment + financingCost,
      financingCost,
      costPer100k: (financingCost / proposal.principal) * 100_000,
      smart: {
        recommended: smartRec,
        feasible: !smartRec.infeasible,
        minBudget: smartRec.infeasible ? smartRec.minBudget : 0,
      },
    };
  });

  const ranked = rankProposalOutcomes(outcomes);
  const smartRanked = rankSmartOutcomes(outcomes);

  return {
    v1: {
      fingerprintVersion: COMPARISON_FINGERPRINT_VERSION,
      inputFingerprint: comparatorInputFingerprint({ proposals: normalized, monthlyBudget: input.monthlyBudget }),
      outcomes,
      ranked,
      best: ranked[0] ?? null,
      smartRanked,
      computedAt: new Date().toISOString(),
    },
  };
}
