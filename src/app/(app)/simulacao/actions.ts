'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance, spendCredit } from '@/lib/credits';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';

export type SaveResult = { id: string } | { error: string };

export async function saveSimulation(
  input: LoanInput,
  strategies: Strategies,
  result: { price: SimulationResult; sac: SimulationResult }
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');

  const { credits, isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited && credits < 2) return { error: 'Créditos insuficientes' };
  if (!isUnlimited) {
    await spendCredit(session.userId, 'Simulação PRICE');
    await spendCredit(session.userId, 'Simulação SAC');
  }

  const [row] = await db
    .insert(schema.simulations)
    .values({
      userId: session.userId,
      name: `Simulação ${new Date().toLocaleDateString('pt-BR')}`,
      payload: JSON.stringify({ input, strategies }),
      result: JSON.stringify(result),
      system: input?.system ?? 'PRICE',
      creditsSpent: 2,
    })
    .returning();
  return { id: row.id };
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
