import { normalizeProposal, assertProposalCount, ComparatorValidationError } from './validate';
import {
  COMPARISON_ENGINE_VERSION,
  COMPARISON_FINGERPRINT_VERSION,
  comparatorInputFingerprint,
  computeComparator,
  rankProposalOutcomes,
  rankSmartOutcomes,
  type ComparatorResult,
  type ProposalOutcome,
} from './calculate';
import type { ComparatorInput } from './types';

export function serializeComparisonInput(input: ComparatorInput): string {
  assertProposalCount(input.proposals);
  const errors = validateSerializableInput(input);
  if (errors) throw new ComparatorValidationError(errors);
  const proposals = input.proposals.map((proposal) => normalizeProposal(proposal as unknown as Record<string, unknown>));
  return JSON.stringify({ version: 1, monthlyBudget: input.monthlyBudget, proposals });
}

export function deserializeComparisonInput(raw: string): ComparatorInput {
  return deserialize(raw);
}

export function deserializeStoredComparisonInput(raw: string): ComparatorInput {
  return deserialize(raw, { legacy: true });
}

export function deserializeStoredComparisonSnapshot(
  raw: string,
  storedResult: unknown,
  engineVersion = COMPARISON_ENGINE_VERSION
): { input: ComparatorInput; result: ComparatorResult; recalculated: boolean } {
  const input = deserializeStoredComparisonInput(raw);
  const parsedResult = parseStoredResult(storedResult);
  if (engineVersion === COMPARISON_ENGINE_VERSION && isStoredResultConsistent(input, parsedResult)) {
    return { input, result: remapStoredResult(input, parsedResult), recalculated: false };
  }
  return { input, result: computeComparator(input, { legacy: true }), recalculated: true };
}

export function isStoredResultConsistent(input: ComparatorInput, value: unknown): value is ComparatorResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<ComparatorResult>;
  const v1 = result.v1;
  if (
    !v1 ||
    v1.fingerprintVersion !== COMPARISON_FINGERPRINT_VERSION ||
    v1.inputFingerprint !== comparatorInputFingerprint(input)
  ) return false;
  if (!Array.isArray(v1.outcomes) || v1.outcomes.length !== input.proposals.length) return false;
  if (!Array.isArray(v1.ranked) || !Array.isArray(v1.smartRanked) || !isStoredDate(v1.computedAt)) return false;
  const outcomeIds = v1.outcomes.map((outcome) => outcome?.proposal?.id);
  if (outcomeIds.some((id) => typeof id !== 'string')) return false;
  if (!v1.outcomes.every((outcome, index) =>
    outcome?.proposal &&
    isOutcomeValid(outcome) &&
    proposalFingerprint(outcome.proposal) === proposalFingerprint(input.proposals[index]) &&
    outcome.result?.input?.principal === input.proposals[index].principal &&
    outcome.result.input.annualRate === input.proposals[index].annualRate &&
    outcome.result.input.months === input.proposals[index].months &&
    outcome.result.input.system === input.proposals[index].system &&
    outcome.result.input.trMonthly === input.proposals[index].trMonthly &&
    outcome.result.input.insuranceMonthly === input.proposals[index].insuranceMonthly &&
    outcome.result.input.bank === input.proposals[index].bank
  )) return false;
  const rankedIndices = matchCollection(v1.outcomes, v1.ranked);
  const smartIndices = matchCollection(v1.outcomes, v1.smartRanked);
  if (!rankedIndices || !smartIndices) return false;
  const expectedRankedIndices = rankProposalOutcomes(v1.outcomes).map((outcome) => v1.outcomes.indexOf(outcome));
  const expectedSmartIndices = rankSmartOutcomes(v1.outcomes).map((outcome) => v1.outcomes.indexOf(outcome));
  if (!sameIndices(rankedIndices, expectedRankedIndices) || !sameIndices(smartIndices, expectedSmartIndices)) return false;
  const bestIndex = v1.best ? matchCollection(v1.outcomes, [v1.best])?.[0] : undefined;
  return bestIndex !== undefined && bestIndex === rankedIndices[0];
}

function sameIndices(actual: number[], expected: number[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function proposalFingerprint(proposal: ComparatorInput['proposals'][number]): string {
  return comparatorInputFingerprint({ monthlyBudget: 1, proposals: [proposal] });
}

function remapStoredResult(input: ComparatorInput, result: ComparatorResult): ComparatorResult {
  const outcomes = structuredClone(result.v1.outcomes).map((outcome, index) => ({
    ...outcome,
    proposal: { ...outcome.proposal, id: input.proposals[index].id },
  }));
  const ranked = rankProposalOutcomes(outcomes);
  return {
    v1: {
      fingerprintVersion: result.v1.fingerprintVersion,
      inputFingerprint: result.v1.inputFingerprint,
      outcomes,
      ranked,
      best: ranked[0] ?? null,
      smartRanked: rankSmartOutcomes(outcomes),
      computedAt: result.v1.computedAt,
    },
  };
}

function parseStoredResult(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function matchCollection(outcomes: ProposalOutcome[], collection: ProposalOutcome[]): number[] | null {
  if (collection.length > outcomes.length) return null;
  const unused = new Set(outcomes.map((_, index) => index));
  const indices: number[] = [];
  for (const reference of collection) {
    if (!reference?.proposal) return null;
    const fingerprint = proposalFingerprint(reference.proposal);
    const exact = [...unused].find((index) =>
      outcomes[index].proposal.id === reference.proposal.id &&
      proposalFingerprint(outcomes[index].proposal) === fingerprint
    );
    const index = exact ?? [...unused].find((candidate) =>
      proposalFingerprint(outcomes[candidate].proposal) === fingerprint
    );
    if (index === undefined) return null;
    unused.delete(index);
    indices.push(index);
  }
  return collection.length === outcomes.length && unused.size > 0 ? null : indices;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length <= allowed.length && keys.every((key) => allowed.includes(key));
}

function isStoredDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && Number.isFinite(Date.parse(value));
}

function isMonth(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 600;
}

function isNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1_000_000_000_000_000;
}

function isReduceMode(value: unknown): boolean {
  return value === 'term' || value === 'payment';
}

function isOptionalMonth(value: unknown): boolean {
  return value === undefined || isMonth(value);
}

function isOptionalReduceMode(value: unknown): boolean {
  return value === undefined || isReduceMode(value);
}

function isLoanInputValid(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if (!hasOnlyKeys(input, ['system', 'principal', 'annualRate', 'months', 'trMonthly', 'insuranceMonthly', 'insuranceSplit', 'bank'])) return false;
  if ((input.system !== 'SAC' && input.system !== 'PRICE') ||
    !isFiniteNumber(input.principal) || input.principal < 0 || input.principal > 1_000_000_000_000 ||
    !isFiniteNumber(input.annualRate) || input.annualRate < 0 || input.annualRate > 1 ||
    !isMonth(input.months) ||
    !isFiniteNumber(input.trMonthly) || input.trMonthly < 0 || input.trMonthly > 0.1 ||
    !isNonNegative(input.insuranceMonthly) ||
    typeof input.bank !== 'string' || input.bank.length > 1000) return false;
  const split = input.insuranceSplit;
  if (!split || typeof split !== 'object') return false;
  const insuranceSplit = split as Record<string, unknown>;
  return hasOnlyKeys(insuranceSplit, ['taxPct', 'insurancePct']) &&
    isNonNegative(insuranceSplit.taxPct) && isNonNegative(insuranceSplit.insurancePct);
}

function isSimulationValid(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const simulation = value as Record<string, unknown>;
  if (!hasOnlyKeys(simulation, ['system', 'input', 'strategies', 'installments', 'metrics'])) return false;
  if (!simulation.input || !simulation.metrics || !simulation.strategies || !Array.isArray(simulation.installments)) return false;
  if (simulation.installments.length === 0 || simulation.installments.length > 960) return false;
  if (simulation.system !== 'SAC' && simulation.system !== 'PRICE') return false;
  if (!isLoanInputValid(simulation.input)) return false;
  const input = simulation.input as Record<string, unknown>;
  if (simulation.system !== input.system) return false;
  const metrics = simulation.metrics as Record<string, unknown>;
  if (!hasOnlyKeys(metrics, [
    'cetRealAnual', 'totalPago', 'totalJuros', 'totalAmortizacao', 'totalCorrecao', 'totalSeguro',
    'dividaAlemDaDivida', 'dividaCai12m', 'dividaCai3a', 'saldoZeroAt', 'parcelaPagaDividaPct', 'paymentApplied',
  ])) return false;
  if (!['totalPago', 'totalJuros', 'totalAmortizacao', 'totalCorrecao', 'totalSeguro', 'saldoZeroAt']
    .every((key) => isNonNegative(metrics[key])) || typeof metrics.paymentApplied !== 'boolean') return false;
  if (!['cetRealAnual', 'dividaAlemDaDivida', 'dividaCai12m', 'dividaCai3a', 'parcelaPagaDividaPct']
    .every((key) => isFiniteNumber(metrics[key]) && Math.abs(metrics[key] as number) <= 1_000_000_000_000_000)) return false;
  if (!Number.isInteger(metrics.saldoZeroAt) || (metrics.saldoZeroAt as number) < 1 || (metrics.saldoZeroAt as number) > 960) return false;
  if (!isStrategiesValid(simulation.strategies)) return false;
  const installmentsValid = simulation.installments.every((item, index) => {
    if (!item || typeof item !== 'object') return false;
    const installment = item as Record<string, unknown>;
    if (!hasOnlyKeys(installment, ['month', 'juros', 'amortizacao', 'seguro', 'correcao', 'extra', 'parcela', 'saldo', 'valorUtil', 'pctValorUtil'])) return false;
    return installment.month === index + 1 &&
      ['juros', 'amortizacao', 'seguro', 'correcao', 'extra', 'parcela', 'saldo']
        .every((key) => isNonNegative(installment[key])) &&
      ['valorUtil', 'pctValorUtil'].every((key) => isFiniteNumber(installment[key]));
  });
  if (!installmentsValid) return false;
  const finalInstallment = simulation.installments.at(-1) as Record<string, unknown>;
  if (metrics.saldoZeroAt !== simulation.installments.length || Number(finalInstallment.saldo) > 0.005) return false;
  const totals = simulation.installments.reduce((sum, rawItem) => {
    const item = rawItem as Record<string, unknown>;
    return {
      totalPago: sum.totalPago + Number(item.parcela),
      totalJuros: sum.totalJuros + Number(item.juros),
      totalAmortizacao: sum.totalAmortizacao + Number(item.amortizacao),
      totalCorrecao: sum.totalCorrecao + Number(item.correcao),
      totalSeguro: sum.totalSeguro + Number(item.seguro),
    };
  }, { totalPago: 0, totalJuros: 0, totalAmortizacao: 0, totalCorrecao: 0, totalSeguro: 0 });
  return Object.entries(totals).every(([key, total]) => approximatelyEqual(total as number, metrics[key] as number));
}

function isStrategiesValid(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const strategies = value as Record<string, unknown>;
  if (!hasOnlyKeys(strategies, [
    'extraLumpSum', 'extraMonthlyPct', 'extraMonthlyPctStartMonth', 'extraMonthlyPctUntilMonth',
    'extraMonthlyPctReduceMode', 'fixedPayment', 'fgtsAnnual', 'recurringExtra', 'paySacParcela',
    'reduceMode', 'portability',
  ])) return false;
  if (!Array.isArray(strategies.extraLumpSum) || strategies.extraLumpSum.length > 600) return false;
  if (!isReduceMode(strategies.reduceMode)) return false;
  return strategies.extraLumpSum.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const extra = entry as Record<string, unknown>;
    if (!hasOnlyKeys(extra, ['month', 'amount', 'reduceMode'])) return false;
    return isMonth(extra.month) && isNonNegative(extra.amount) && isOptionalReduceMode(extra.reduceMode);
  }) && (strategies.extraMonthlyPct === undefined ||
      (isFiniteNumber(strategies.extraMonthlyPct) && strategies.extraMonthlyPct >= 0 && strategies.extraMonthlyPct <= 1)) &&
    isOptionalMonth(strategies.extraMonthlyPctStartMonth) &&
    isOptionalMonth(strategies.extraMonthlyPctUntilMonth) &&
    optionalBoolean(strategies.paySacParcela) &&
    isOptionalReduceMode(strategies.extraMonthlyPctReduceMode) &&
    isFixedPaymentValid(strategies.fixedPayment) &&
    isFgtsAnnualValid(strategies.fgtsAnnual) &&
    isRecurringExtraValid(strategies.recurringExtra) &&
    isPortabilityValid(strategies.portability);
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function isFixedPaymentValid(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  return hasOnlyKeys(object, ['amount', 'startMonth', 'untilMonth', 'reduceMode']) &&
    isNonNegative(object.amount) && isOptionalMonth(object.startMonth) &&
    isOptionalMonth(object.untilMonth) && isOptionalReduceMode(object.reduceMode);
}

function isFgtsAnnualValid(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  return hasOnlyKeys(object, ['amount', 'startMonth', 'untilMonth', 'reduceMode']) &&
    isNonNegative(object.amount) && isOptionalMonth(object.startMonth) &&
    isOptionalMonth(object.untilMonth) && isOptionalReduceMode(object.reduceMode);
}

function isRecurringExtraValid(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  return hasOnlyKeys(object, ['amount', 'every', 'startMonth', 'untilMonth', 'reduceMode']) &&
    isNonNegative(object.amount) && isMonth(object.every) && isMonth(object.startMonth) &&
    isOptionalMonth(object.untilMonth) && isOptionalReduceMode(object.reduceMode);
}

function isPortabilityValid(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  return hasOnlyKeys(object, ['annualRate', 'bank', 'insuranceMonthly']) &&
    isFiniteNumber(object.annualRate) && object.annualRate >= 0 && object.annualRate <= 1 &&
    typeof object.bank === 'string' && object.bank.length <= 60 && isNonNegative(object.insuranceMonthly);
}

function isCandidateValid(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!hasOnlyKeys(candidate, ['system', 'months', 'parcela', 'extraMonthlyPct', 'extraMonthlyAmount', 'result'])) return false;
  if ((candidate.system !== 'SAC' && candidate.system !== 'PRICE') || !isMonth(candidate.months) ||
    !isNonNegative(candidate.parcela) || !isFiniteNumber(candidate.extraMonthlyPct) ||
    candidate.extraMonthlyPct < 0 || !isNonNegative(candidate.extraMonthlyAmount) ||
    !isSimulationValid(candidate.result)) return false;
  const result = candidate.result as Record<string, unknown>;
  const input = result.input as Record<string, unknown>;
  const strategies = result.strategies as Record<string, unknown>;
  const first = (result.installments as Record<string, number>[])[0];
  const parcela = first.parcela - first.extra;
  if (!approximatelyEqual(candidate.parcela as number, parcela) ||
    !approximatelyEqual(candidate.extraMonthlyAmount as number, first.extra) ||
    !approximatelyEqual(candidate.extraMonthlyPct as number, parcela > 0 ? first.extra / parcela : 0)) return false;
  if (result.system !== candidate.system || input.system !== candidate.system || input.months !== candidate.months) return false;
  if (strategies.fixedPayment !== undefined) {
    const fixed = strategies.fixedPayment as { amount: number; startMonth?: number };
    const available = Number(input.principal) + first.correcao - (first.amortizacao - first.extra);
    const expectedExtra = (fixed.startMonth ?? 1) <= 1
      ? Math.min(Math.max(0, fixed.amount - parcela), Math.max(0, available))
      : 0;
    return approximatelyEqual(first.extra, expectedExtra);
  }
  return candidate.extraMonthlyPct <= 1 && (strategies.extraMonthlyPct === undefined ||
    approximatelyEqual(strategies.extraMonthlyPct as number, candidate.extraMonthlyPct as number));
}

function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecommendationValid(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const recommendation = value as Record<string, unknown>;
  if (!hasOnlyKeys(recommendation, ['best', 'alternatives', 'comparison', 'modes', 'paymentMinParcela', 'maxTerms', 'infeasible', 'minBudget'])) return false;
  if (!['best', 'alternatives', 'comparison', 'modes', 'paymentMinParcela', 'maxTerms', 'infeasible', 'minBudget'].every((key) => hasOwn(recommendation, key))) return false;
  if (recommendation.best !== null && !isCandidateValid(recommendation.best)) return false;
  if (!Array.isArray(recommendation.alternatives) || recommendation.alternatives.length > 4 || !recommendation.alternatives.every(isCandidateValid)) return false;
  if (!Array.isArray(recommendation.comparison) || recommendation.comparison.length !== 2) return false;
  const systems = new Set<string>();
  for (const value of recommendation.comparison) {
    if (!value || typeof value !== 'object') return false;
    const comparison = value as Record<string, unknown>;
    if (!hasOnlyKeys(comparison, ['system', 'feasible', 'minParcela', 'candidate'])) return false;
    if ((comparison.system !== 'SAC' && comparison.system !== 'PRICE') || systems.has(comparison.system)) return false;
    systems.add(comparison.system);
    if (typeof comparison.feasible !== 'boolean' || !isFiniteNumber(comparison.minParcela)) return false;
    if (comparison.candidate !== undefined && !isCandidateValid(comparison.candidate)) return false;
  }
  if (!recommendation.modes || typeof recommendation.modes !== 'object' || Array.isArray(recommendation.modes)) return false;
  const modes = recommendation.modes as Record<string, unknown>;
  if (!hasOnlyKeys(modes, ['term', 'payment'])) return false;
  if (!hasOwn(modes, 'term') || !hasOwn(modes, 'payment')) return false;
  if (modes.term !== null && !isCandidateValid(modes.term)) return false;
  if (modes.payment !== null && !isCandidateValid(modes.payment)) return false;
  if (!Array.isArray(recommendation.maxTerms) || recommendation.maxTerms.length > 2 || !recommendation.maxTerms.every(isCandidateValid)) return false;
  if (recommendation.paymentMinParcela !== null && !isFiniteNumber(recommendation.paymentMinParcela)) return false;
  return typeof recommendation.infeasible === 'boolean' && isFiniteNumber(recommendation.minBudget);
}

function isOutcomeValid(outcome: ProposalOutcome): boolean {
  if (!hasOnlyKeys(outcome as unknown as Record<string, unknown>, [
    'proposal', 'result', 'cetCalculated', 'cetAlert', 'acquisitionCost', 'financingCost', 'costPer100k', 'smart',
  ])) return false;
  if (!isStoredProposalValid(outcome.proposal)) return false;
  if (!isSimulationValid(outcome.result)) return false;
  if (![outcome.cetCalculated, outcome.acquisitionCost, outcome.financingCost, outcome.costPer100k].every(isFiniteNumber) || typeof outcome.cetAlert !== 'boolean') return false;
  const smart = outcome.smart;
  if (!smart || !hasOnlyKeys(smart as unknown as Record<string, unknown>, ['recommended', 'feasible', 'minBudget']) || typeof smart.feasible !== 'boolean' || !isFiniteNumber(smart.minBudget)) return false;
  return isRecommendationValid(smart.recommended);
}

function isStoredProposalValid(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const proposal = value as Record<string, unknown>;
  if (!hasOnlyKeys(proposal, [
    'id', 'bank', 'name', 'propertyValue', 'downPayment', 'principal', 'principalManual', 'system', 'months',
    'annualRate', 'annualRateValue', 'annualRateKind', 'cetInformed', 'trMonthly', 'insuranceMonthly', 'fees',
  ])) return false;
  if (typeof proposal.id !== 'string' || proposal.id.length > 100 || typeof proposal.bank !== 'string' || proposal.bank.length > 1000) return false;
  if (proposal.name !== undefined && (typeof proposal.name !== 'string' || proposal.name.length > 1000)) return false;
  if (!['propertyValue', 'downPayment', 'principal', 'months', 'annualRate', 'cetInformed', 'trMonthly', 'insuranceMonthly']
    .every((key) => isFiniteNumber(proposal[key]))) return false;
  if (proposal.principalManual !== undefined && typeof proposal.principalManual !== 'boolean') return false;
  if (proposal.system !== 'SAC' && proposal.system !== 'PRICE') return false;
  if (proposal.annualRateValue !== undefined && !isFiniteNumber(proposal.annualRateValue)) return false;
  if (proposal.annualRateKind !== undefined && !['effective-annual', 'nominal-annual', 'effective-monthly'].includes(proposal.annualRateKind as string)) return false;
  if (!Array.isArray(proposal.fees) || proposal.fees.length > 100) return false;
  return proposal.fees.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const fee = value as Record<string, unknown>;
    return hasOnlyKeys(fee, ['id', 'label', 'amount', 'includeInCet']) &&
      typeof fee.id === 'string' && fee.id.length <= 100 && typeof fee.label === 'string' && fee.label.length <= 1000 &&
      isFiniteNumber(fee.amount) && typeof fee.includeInCet === 'boolean';
  });
}

function deserialize(raw: string, options: { legacy?: boolean } = {}): ComparatorInput {
  const parsed = JSON.parse(raw) as { version?: number; monthlyBudget?: number; proposals?: unknown[] };
  if (parsed?.version !== 1 || !Array.isArray(parsed.proposals)) {
    throw new ComparatorValidationError('Dados da comparação inválidos.');
  }
  assertProposalCount(parsed.proposals);
  const rawProposals = options.legacy ? normalizeLegacyIds(parsed.proposals) : parsed.proposals;
  if (!options.legacy) {
    const ids = rawProposals.map((proposal) => (proposal as Record<string, unknown>)?.id);
    if (new Set(ids).size !== ids.length) throw new ComparatorValidationError('Identificador da proposta duplicado.');
  }
  const proposals = rawProposals.map((p) => normalizeProposal((p ?? {}) as Record<string, unknown>, options));
  const monthlyBudget = Number(parsed.monthlyBudget);
  if (!Number.isFinite(monthlyBudget) || !(monthlyBudget > 0)) {
    throw new ComparatorValidationError('Orçamento mensal inválido.');
  }
  return { proposals, monthlyBudget };
}

function validateSerializableInput(input: ComparatorInput): string | null {
  if (new Set(input.proposals.map((proposal) => proposal.id)).size !== input.proposals.length) {
    return 'Identificador da proposta duplicado.';
  }
  for (const proposal of input.proposals) {
    try {
      normalizeProposal(proposal as unknown as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ComparatorValidationError) return error.message;
      throw error;
    }
  }
  return null;
}

function normalizeLegacyIds(proposals: unknown[]): unknown[] {
  const usedProposalIds = new Set<string>();
  return proposals.map((value, proposalIndex) => {
    const proposal = { ...((value ?? {}) as Record<string, unknown>) };
    const originalId = typeof proposal.id === 'string' ? proposal.id.trim() : '';
    proposal.id = uniqueLegacyId(originalId, `p${proposalIndex + 1}`, usedProposalIds);
    if (Array.isArray(proposal.fees)) {
      const usedFeeIds = new Set<string>();
      proposal.fees = proposal.fees.map((feeValue, feeIndex) => {
        const fee = { ...((feeValue ?? {}) as Record<string, unknown>) };
        const feeId = typeof fee.id === 'string' ? fee.id.trim() : '';
        fee.id = uniqueLegacyId(feeId, `f${feeIndex + 1}`, usedFeeIds);
        return fee;
      });
    }
    return proposal;
  });
}

function uniqueLegacyId(preferred: string, fallback: string, used: Set<string>): string {
  if (/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(preferred) && !used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }
  let candidate = fallback;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${fallback}-${suffix++}`;
  used.add(candidate);
  return candidate;
}
