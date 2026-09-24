'use server';

import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { captureAccountEvent } from '@/lib/analytics/server';
import { validateLoanInput } from '@/lib/finance/engine';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';

export type SaveResult = { id: string } | { error: string };

export async function saveSimulation(
  input: LoanInput,
  strategies: Strategies,
  result: { price: SimulationResult; sac: SimulationResult }
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');
  try {
    validateLoanInput(input, strategies);
  } catch {
    return { error: 'Dados da simulação inválidos' };
  }

  // Fast-path pre-check (UX): authoritative check happens inside the transaction.
  const { credits, isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited && credits < 1) return { error: 'Créditos insuficientes' };

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
    if (!unlimited && bal.sum < 1) return null;

    if (!unlimited) {
      await tx
        .insert(schema.creditLedger)
        .values({ userId: session.userId, amount: -1, kind: 'spend', description: 'Simulação completa' });
    }

    const [row] = await tx
      .insert(schema.simulations)
      .values({
        userId: session.userId,
        name: `Simulação ${new Date().toLocaleDateString('pt-BR')}`,
        payload: { input, strategies },
        result,
        system: input.system,
        creditsSpent: 1,
      })
      .returning();
    return row.id;
  });

  if (savedId == null) return { error: 'Créditos insuficientes' };
  await captureAccountEvent(session.userId, 'simulation_completed', savedId);
  return { id: savedId };
}

const FREE_RETENTION_MS = 6 * 60 * 60 * 1000;

async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.status, 'active'),
      gt(schema.subscriptions.currentPeriodEnd, new Date())
    ),
  });
  return Boolean(sub);
}

export async function listSimulations() {
  const session = await auth();
  if (!session?.userId) return [];
  const retentionCut = (await hasActiveSubscription(session.userId))
    ? null
    : new Date(Date.now() - FREE_RETENTION_MS);
  return db
    .select()
    .from(schema.simulations)
    .where(and(
      eq(schema.simulations.userId, session.userId),
      retentionCut ? gt(schema.simulations.createdAt, retentionCut) : undefined
    ))
    .orderBy(desc(schema.simulations.createdAt))
    .limit(50);
}

export async function loadSimulation(id: string) {
  const session = await auth();
  if (!session?.userId) return null;
  const row = await db.query.simulations.findFirst({
    where: and(
      eq(schema.simulations.id, id),
      eq(schema.simulations.userId, session.userId)
    ),
  });
  if (!row) return null;
  if (await hasActiveSubscription(session.userId)) return row;
  if (row.createdAt.getTime() <= Date.now() - FREE_RETENTION_MS) return null;
  return row;
}

export async function deleteSimulation(id: string) {
  const session = await auth();
  if (!session?.userId) return;
  await db
    .delete(schema.simulations)
    .where(and(eq(schema.simulations.id, id), eq(schema.simulations.userId, session.userId)));
  revalidatePath('/minhas-simulacoes');
}

export async function saveToolSimulation(input: {
  name: string;
  system: string;
  payload: unknown;
  result: unknown;
  charge: boolean;
}): Promise<SaveResult> {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');
  const { name, system, payload, result, charge } = input;

  const savedId = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${session.userId} FOR UPDATE`);
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
    if (charge && !unlimited) {
      if (bal.sum < 1) return null;
      await tx
        .insert(schema.creditLedger)
        .values({ userId: session.userId, amount: -1, kind: 'spend', description: system });
    }
    const [row] = await tx
      .insert(schema.simulations)
      .values({
        userId: session.userId,
        name,
        payload,
        result,
        system,
        creditsSpent: charge && !unlimited ? 1 : 0,
      })
      .returning();
    return row.id;
  });

  if (savedId == null) return { error: 'Créditos insuficientes' };
  await captureAccountEvent(session.userId, 'simulation_completed', savedId);
  revalidatePath('/minhas-simulacoes');
  return { id: savedId };
}
