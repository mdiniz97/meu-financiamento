'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { assertSameOrigin } from '@/lib/security/same-origin';
import { activateTrial, markTrialOfferSeen, type TrialActivationResult } from '@/lib/trial/activate';

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');
  await assertSameOrigin();
  return session.userId;
}

export async function activateTrialAction(): Promise<TrialActivationResult> {
  const userId = await requireUserId();
  const result = await activateTrial(userId);
  revalidatePath('/perfil');
  revalidatePath('/assinatura');
  revalidatePath('/nova-simulacao');
  return result;
}

export async function markTrialOfferSeenAction(): Promise<void> {
  await markTrialOfferSeen(await requireUserId());
}
