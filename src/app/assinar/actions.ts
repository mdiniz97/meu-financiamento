'use server';

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { hasActiveAccess } from '@/lib/subscriptions/access';
import { createSubscriptionCheckout } from '@/lib/payments/asaas/checkout';
import { cancelAtPeriodEnd } from '@/lib/payments/asaas/subscription';
import { getPaymentProvider } from '@/lib/payments';
import { captureAccountEvent } from '@/lib/analytics/server';

function isUniqueViolation(e: unknown): boolean {
  // Drizzle aninha o erro do pg em `cause`; percorre a cadeia até achar o code.
  let err = e as { code?: unknown; cause?: unknown } | null;
  while (err && typeof err.code === 'undefined' && err.cause) {
    err = err.cause as { code?: unknown; cause?: unknown } | null;
  }
  return err?.code === '23505';
}

function resetForNewCheckout(id: string) {
  return db
    .update(schema.subscriptions)
    .set({
      status: 'incomplete',
      asaasCheckoutId: null,
      asaasSubscriptionId: null,
      providerId: null,
    })
    .where(eq(schema.subscriptions.id, id));
}

export async function startSubscription(): Promise<void> {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/assinar');
  const userId = session.userId;

  if (await hasActiveAccess(userId)) redirect('/perfil');

  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, 'unlimited'),
  });
  if (!pack) redirect('/perfil');

  // Modo fake (dev/E2E): auto-aprova e cai em /perfil, como sempre.
  if ((process.env.PAYMENT_PROVIDER ?? 'fake') === 'fake') {
    const { checkoutUrl } = await getPaymentProvider().createCheckout({
      userId,
      packId: 'unlimited',
      priceCents: pack.priceCents,
    });
    const sep = checkoutUrl.includes('?') ? '&' : '?';
    redirect(`${checkoutUrl}${sep}userId=${userId}&packId=unlimited`);
  }

  const existing = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, 'unlimited'),
      eq(schema.subscriptions.provider, 'asaas')
    ),
  });

  let localId: string;
  if (existing) {
    // I4 — recompra com assinatura Asaas ainda ativa pode continuar cobrando.
    // Inativa a antiga antes de abrir o novo checkout e limpa os vínculos.
    if (
      existing.asaasSubscriptionId &&
      existing.asaasStatus !== 'INACTIVE' &&
      existing.asaasStatus !== 'DELETED'
    ) {
      try {
        await cancelAtPeriodEnd(existing.asaasSubscriptionId);
      } catch (e) {
        console.warn(
          `[assinar] falha ao inativar assinatura ${existing.asaasSubscriptionId}: ${String(e)}`
        );
      }
    }
    await resetForNewCheckout(existing.id);
    localId = existing.id;
  } else {
    try {
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
    } catch (e) {
      // T7 — corrida de primeira compra: outra requisição inseriu a linha
      // (índice único user+pack+provider). Reusa a vencedora em vez de 500.
      if (!isUniqueViolation(e)) throw e;
      const winner = await db.query.subscriptions.findFirst({
        where: and(
          eq(schema.subscriptions.userId, userId),
          eq(schema.subscriptions.packId, 'unlimited'),
          eq(schema.subscriptions.provider, 'asaas')
        ),
      });
      if (!winner) throw e;
      localId = winner.id;
    }
  }

  // APP_URL lido em runtime (não no topo do módulo): evita congelar o valor
  // antigo quando .env.local muda; trim da barra final evita `//assinar`.
  const appUrl = (process.env.APP_URL ?? 'http://localhost:3012').replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const checkout = await createSubscriptionCheckout({
    externalReference: localId,
    valueCents: pack.priceCents,
    cycle: 'YEARLY',
    nextDueDate: today,
    successUrl: `${appUrl}/assinar/sucesso`,
    cancelUrl: `${appUrl}/assinar`,
    expiredUrl: `${appUrl}/assinar`,
  });

  await db
    .update(schema.subscriptions)
    .set({ asaasCheckoutId: checkout.id })
    .where(eq(schema.subscriptions.id, localId));

  await captureAccountEvent(userId, 'checkout_started', checkout.id);
  redirect(checkout.link);
}
