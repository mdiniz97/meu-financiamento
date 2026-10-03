import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * Fim do primeiro período pago, somando os dias restantes do trial. Renovações
 * depois disto usam `extendedPeriodEnd` (max(existing, dueDate+ciclo)), então o
 * bônus vale só no 1º período e não empilha.
 */
export function firstPeriodEndWithTrial(baseEnd: Date, trialEnd: Date | null, now: Date): Date {
  if (trialEnd && trialEnd.getTime() > now.getTime()) {
    return new Date(baseEnd.getTime() + (trialEnd.getTime() - now.getTime()));
  }
  return baseEnd;
}

/**
 * Na 1ª ativação paga, absorve o trial ativo do usuário: soma o tempo restante
 * ao período e encerra a linha do trial, para parar os followups D+1/D+7/D+30 e
 * não duplicar o acesso. Sem trial ativo, devolve `baseEnd` inalterado.
 */
export async function absorbActiveTrial(
  userId: string,
  baseEnd: Date,
  now = new Date()
): Promise<Date> {
  const trial = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.provider, 'trial')
    ),
  });
  if (
    !trial ||
    trial.status !== 'active' ||
    !trial.currentPeriodEnd ||
    trial.currentPeriodEnd.getTime() <= now.getTime()
  ) {
    return baseEnd;
  }
  await db
    .update(schema.subscriptions)
    .set({ status: 'canceled', canceledAt: now })
    .where(eq(schema.subscriptions.id, trial.id));
  return firstPeriodEndWithTrial(baseEnd, trial.currentPeriodEnd, now);
}
