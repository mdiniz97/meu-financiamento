'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { assertSameOrigin } from '@/lib/security/same-origin';
import {
  cancelOwnSubscription,
  rateLimitOk,
  reactivateOwnSubscription,
  recordSubscriptionEvent,
  type SubscriptionAction,
} from '@/lib/subscriptions/account';

/**
 * RS3 — as ações não recebem parâmetros de alvo: a assinatura vem sempre da
 * sessão. Nada de id/valor/status/plano vindo do cliente.
 */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/assinatura');
  return session.userId;
}

/** RS1 → sessão → RS2 → ação; registra a tentativa mesmo quando recusada. */
async function guard(action: SubscriptionAction): Promise<string | null> {
  await assertSameOrigin();
  const userId = await requireUserId();

  if (!(await rateLimitOk(userId))) {
    await recordSubscriptionEvent({
      userId,
      subscriptionId: null,
      action,
      result: 'rate_limited',
    });
    return null;
  }

  return userId;
}

export async function cancelSubscription(): Promise<void> {
  const userId = await guard('cancel');
  if (!userId) return;

  await cancelOwnSubscription(userId);
  revalidatePath('/assinatura');
  revalidatePath('/perfil');
}

export async function reactivateSubscriptionAction(): Promise<void> {
  const userId = await guard('reactivate');
  if (!userId) return;

  await reactivateOwnSubscription(userId);
  revalidatePath('/assinatura');
  revalidatePath('/perfil');
}
