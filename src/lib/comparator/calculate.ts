import { irrMonthly, simulate } from '@/lib/finance/engine';
import { recommendSmart, type SmartRecommendation } from '@/lib/finance/smart';
import type { SimulationResult } from '@/lib/finance/types';
import { ComparatorValidationError, validateComparator, normalizeProposal } from './validate';
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
    outcomes: ProposalOutcome[];
    ranked: ProposalOutcome[];
    best: ProposalOutcome | null;
    smartRanked: ProposalOutcome[];
    computedAt: string;
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function cetFromFlows(netCredit: number, installments: { parcela: number }[]): number {
  const flows = [-netCredit, ...installments.map((i) => i.parcela)];
  const m = irrMonthly(flows);
  if (!Number.isFinite(m)) return 0;
  return Math.pow(1 + m, 12) - 1;
}

export function computeComparator(input: ComparatorInput): ComparatorResult {
  const errors: ProposalError[] = validateComparator(input);
  if (errors.length > 0) throw new ComparatorValidationError(errors[0].message);
  const normalized = input.proposals.map((p) => normalizeProposal(p as unknown as Record<string, unknown>));

  const outcomes: ProposalOutcome[] = normalized.map((proposal) => {
    const result = simulate({
      system: proposal.system,
      principal: proposal.principal,
      annualRate: proposal.annualRate,
      months: proposal.months,
      trMonthly: proposal.trMonthly,
      insuranceMonthly: proposal.insuranceMonthly,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
      bank: proposal.bank,
    });
    const cetFees = proposal.fees.filter((f) => f.includeInCet).reduce((s, f) => s + f.amount, 0);
    const cetCalculated = cetFromFlows(proposal.principal - cetFees, result.installments);
    const feesTotal = proposal.fees.reduce((s, f) => s + f.amount, 0);
    const financingCost = result.metrics.totalPago + feesTotal;
    const smartRec = recommendSmart({
      principal: proposal.principal,
      annualRate: proposal.annualRate,
      trMonthly: proposal.trMonthly,
      insuranceMonthly: proposal.insuranceMonthly,
      bank: proposal.bank,
      maxMonths: proposal.months,
      maxPayment: input.monthlyBudget,
      fixedUntilMonth: undefined,
    });
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

  const ranked = [...outcomes].sort(
    (a, b) =>
      a.acquisitionCost - b.acquisitionCost ||
      a.costPer100k - b.costPer100k ||
      b.proposal.principal - a.proposal.principal
  );

  const smartRanked = [...outcomes].sort((a, b) => {
    const fa = a.smart?.feasible ? 0 : 1;
    const fb = b.smart?.feasible ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const ta = a.smart?.recommended.best?.result.metrics.totalPago ?? Infinity;
    const tb = b.smart?.recommended.best?.result.metrics.totalPago ?? Infinity;
    return ta - tb;
  });

  return {
    v1: {
      outcomes,
      ranked,
      best: ranked[0] ?? null,
      smartRanked,
      computedAt: new Date().toISOString(),
    },
  };
}
