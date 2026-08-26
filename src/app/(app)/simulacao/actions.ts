'use server';

import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';

export type SaveResult = { id: string } | { error: string };

export async function saveSimulation(
  input: LoanInput,
  strategies: Strategies,
  result: { price: SimulationResult; sac: SimulationResult }
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');

  // Fast-path pre-check (UX): authoritative check happens inside the transaction.
  const { credits, isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited && credits < 2) return { error: 'Créditos insuficientes' };

  const savedId = await db.transaction(async (tx) => {
    // Serialize saves per user: lock the users row so concurrent saves queue up.
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${session.userId} FOR UPDATE`);

    // Authoritative balance inside the tx (post-lock, fresh state).
    const [bal] = await tx
      .select({
        sum: sql<number>`coalesce(sum(${schema.creditLedger.amount}), 0)::int`,
      })
      .from(schema.creditLedger)
      .where(eq(schema.creditLedger.userId, session.userId));
    const sub = await tx.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, session.userId),
        eq(schema.subscriptions.status, 'active'),
        gt(schema.subscriptions.currentPeriodEnd, new Date())
      ),
    });
    const unlimited = Boolean(sub);
    if (!unlimited && bal.sum < 2) return null;

    if (!unlimited) {
      await tx
        .insert(schema.creditLedger)
        .values({ userId: session.userId, amount: -1, kind: 'spend', description: 'Simulação PRICE' });
      await tx
        .insert(schema.creditLedger)
        .values({ userId: session.userId, amount: -1, kind: 'spend', description: 'Simulação SAC' });
    }

    const [row] = await tx
      .insert(schema.simulations)
      .values({
        userId: session.userId,
        name: `Simulação ${new Date().toLocaleDateString('pt-BR')}`,
        payload: JSON.stringify({ input, strategies }),
        result: JSON.stringify(result),
        system: input.system,
        creditsSpent: 2,
      })
      .returning();
    return row.id;
  });

  if (savedId == null) return { error: 'Créditos insuficientes' };
  return { id: savedId };
}

export async function listSimulations() {
  const session = await auth();
  if (!session?.userId) return [];
  return db
    .select()
    .from(schema.simulations)
    .where(eq(schema.simulations.userId, session.userId))
    .orderBy(desc(schema.simulations.createdAt))
    .limit(50);
}

export async function loadSimulation(id: string) {
  const session = await auth();
  if (!session?.userId) return null;
  return db.query.simulations.findFirst({
    where: and(
      eq(schema.simulations.id, id),
      eq(schema.simulations.userId, session.userId)
    ),
  });
}

export async function deleteSimulation(id: string) {
  const session = await auth();
  if (!session?.userId) return;
  await db
    .delete(schema.simulations)
    .where(and(eq(schema.simulations.id, id), eq(schema.simulations.userId, session.userId)));
  revalidatePath('/minhas-simulacoes');
}
