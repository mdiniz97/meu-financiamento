'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { cancelAtPeriodEnd } from '@/lib/payments/asaas/subscription';

export async function cancelSubscription(): Promise<void> {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/perfil');
  const userId = session.userId;

  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, 'unlimited'),
      eq(schema.subscriptions.provider, 'asaas'),
      eq(schema.subscriptions.status, 'active')
    ),
  });
  if (!subscription) return;

  if (subscription.asaasSubscriptionId) {
    await cancelAtPeriodEnd(subscription.asaasSubscriptionId);
  }

  await db
    .update(schema.subscriptions)
    .set({ cancelAtPeriodEnd: true, canceledAt: new Date() })
    .where(eq(schema.subscriptions.id, subscription.id));

  revalidatePath('/perfil');
}
