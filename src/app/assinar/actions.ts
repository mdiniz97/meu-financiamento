'use server';

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { hasActiveAccess } from '@/lib/subscriptions/access';
import { createSubscriptionCheckout } from '@/lib/payments/asaas/checkout';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3012';

export async function startSubscription(): Promise<void> {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/assinar');
  const userId = session.userId;

  if (await hasActiveAccess(userId)) redirect('/perfil');

  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, 'unlimited'),
  });
  if (!pack) redirect('/perfil');

  const existing = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, 'unlimited'),
      eq(schema.subscriptions.provider, 'asaas')
    ),
  });

  let localId: string;
  if (existing) {
    await db
      .update(schema.subscriptions)
      .set({ status: 'incomplete', asaasCheckoutId: null })
      .where(eq(schema.subscriptions.id, existing.id));
    localId = existing.id;
  } else {
    const [created] = await db
      .insert(schema.subscriptions)
      .values({
        userId,
        packId: 'unlimited',
        provider: 'asaas',
        status: 'incomplete',
        cycle: 'YEARLY',
        billingType: 'CREDIT_CARD',
      })
      .returning({ id: schema.subscriptions.id });
    localId = created.id;
  }

  const today = new Date().toISOString().slice(0, 10);
  const checkout = await createSubscriptionCheckout({
    externalReference: localId,
    valueCents: pack.priceCents,
    cycle: 'YEARLY',
    nextDueDate: today,
    successUrl: `${APP_URL}/assinar/sucesso`,
    cancelUrl: `${APP_URL}/assinar`,
    expiredUrl: `${APP_URL}/assinar`,
  });

  await db
    .update(schema.subscriptions)
    .set({ asaasCheckoutId: checkout.id })
    .where(eq(schema.subscriptions.id, localId));

  redirect(checkout.link);
}
