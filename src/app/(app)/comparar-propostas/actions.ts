'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { computeComparator, type ComparatorResult } from '@/lib/comparator/calculate';
import { serializeComparisonInput, deserializeComparisonInput } from '@/lib/comparator/serialize';
import { ComparatorValidationError } from '@/lib/comparator/validate';
import type { ComparatorInput } from '@/lib/comparator/types';

const ENGINE_VERSION = '1';

function parseJsonb<T>(v: unknown): T {
  return typeof v === 'string' ? (JSON.parse(v) as T) : (v as T);
}

function jsonbToString(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
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
      const res = parseJsonb<ComparatorResult>(r.result);
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
      input: deserializeComparisonInput(jsonbToString(row.proposals)),
      result: parseJsonb<ComparatorResult>(row.result),
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
    const input = deserializeComparisonInput(jsonbToString(row.proposals));
    const fresh = computeComparator(input);
    const prev = parseJsonb<ComparatorResult>(row.result);
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
