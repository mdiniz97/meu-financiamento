import { normalizeProposal, assertAtMostThree, ComparatorValidationError } from './validate';
import type { ComparatorInput } from './types';

export function serializeComparisonInput(input: ComparatorInput): string {
  assertAtMostThree(input.proposals);
  return JSON.stringify({ version: 1, monthlyBudget: input.monthlyBudget, proposals: input.proposals });
}

export function deserializeComparisonInput(raw: string): ComparatorInput {
  const parsed = JSON.parse(raw) as { version?: number; monthlyBudget?: number; proposals?: unknown[] };
  if (parsed?.version !== 1 || !Array.isArray(parsed.proposals)) {
    throw new ComparatorValidationError('Dados da comparação inválidos.');
  }
  const proposals = parsed.proposals.map((p) => normalizeProposal((p ?? {}) as Record<string, unknown>));
  const monthlyBudget = Number(parsed.monthlyBudget);
  if (!(monthlyBudget > 0)) throw new ComparatorValidationError('Orçamento mensal inválido.');
  return { proposals, monthlyBudget };
}
