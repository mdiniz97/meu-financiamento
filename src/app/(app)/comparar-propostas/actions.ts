'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { computeComparator, type ComparatorResult } from '@/lib/comparator/calculate';
import { normalizeProposal, assertAtMostThree, ComparatorValidationError } from '@/lib/comparator/validate';
import type { ComparatorInput } from '@/lib/comparator/types';

const ENGINE_VERSION = '1';

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

async function requireUnlimited() {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) throw new Error('Recurso exclusivo do plano Ilimitado');
  return session.userId;
}

export type ComparisonSummary = {
  id: string;
  name: string;
  bestBank: string | null;
  createdAt: Date;
};

export async function saveComparison(input: ComparatorInput, name: string): Promise<{ id: string } | { error: string }> {
  try {
    const userId = await requireUnlimited();
    const result = computeComparator(input);
    const [row] = await db
      .insert(schema.proposalComparisons)
      .values({
        userId,
        name: name.trim() || `Comparação ${new Date().toLocaleDateString('pt-BR')}`,
        monthlyBudget: input.monthlyBudget,
        proposals: serializeComparisonInput(input),
        result: JSON.stringify(result),
        engineVersion: ENGINE_VERSION,
      })
      .returning();
    revalidatePath('/comparar-propostas');
    return { id: row.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao salvar' };
  }
}

export async function listComparisons(): Promise<ComparisonSummary[]> {
  const session = await auth();
  if (!session?.userId) return [];
  const rows = await db
    .select({
      id: schema.proposalComparisons.id,
      name: schema.proposalComparisons.name,
      result: schema.proposalComparisons.result,
      createdAt: schema.proposalComparisons.createdAt,
    })
    .from(schema.proposalComparisons)
    .where(eq(schema.proposalComparisons.userId, session.userId))
    .orderBy(desc(schema.proposalComparisons.createdAt))
    .limit(50);
  return rows.map((r) => {
    let bestBank: string | null = null;
    try {
      const res = JSON.parse(r.result as unknown as string) as ComparatorResult;
      bestBank = res.v1.best?.proposal.bank ?? null;
    } catch {
      // resultado antigo/corrompido
    }
    return { id: r.id, name: r.name, bestBank, createdAt: r.createdAt };
  });
}

export async function loadComparison(
  id: string
): Promise<{ input: ComparatorInput; result: ComparatorResult; name: string; engineVersion: string } | null> {
  const session = await auth();
  if (!session?.userId) return null;
  const row = await db.query.proposalComparisons.findFirst({
    where: and(eq(schema.proposalComparisons.id, id), eq(schema.proposalComparisons.userId, session.userId)),
  });
  if (!row) return null;
  try {
    return {
      input: deserializeComparisonInput(row.proposals as unknown as string),
      result: JSON.parse(row.result as unknown as string) as ComparatorResult,
      name: row.name,
      engineVersion: row.engineVersion,
    };
  } catch {
    return null;
  }
}

export async function recalculateComparison(
  id: string
): Promise<{ result: ComparatorResult; changed: boolean } | { error: string }> {
  try {
    const userId = await requireUnlimited();
    const row = await db.query.proposalComparisons.findFirst({
      where: and(eq(schema.proposalComparisons.id, id), eq(schema.proposalComparisons.userId, userId)),
    });
    if (!row) return { error: 'Comparação não encontrada' };
    const input = deserializeComparisonInput(row.proposals as unknown as string);
    const fresh = computeComparator(input);
    const prev = JSON.parse(row.result as unknown as string) as ComparatorResult;
    const changed = JSON.stringify(prev) !== JSON.stringify(fresh);
    await db
      .update(schema.proposalComparisons)
      .set({ result: JSON.stringify(fresh), engineVersion: ENGINE_VERSION })
      .where(eq(schema.proposalComparisons.id, id));
    return { result: fresh, changed };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao recalcular' };
  }
}

export async function deleteComparison(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.userId) return { error: 'Não autenticado' };
    await db
      .delete(schema.proposalComparisons)
      .where(and(eq(schema.proposalComparisons.id, id), eq(schema.proposalComparisons.userId, session.userId)));
    revalidatePath('/comparar-propostas');
    return { ok: true };
  } catch {
    return { error: 'Erro ao excluir' };
  }
}
