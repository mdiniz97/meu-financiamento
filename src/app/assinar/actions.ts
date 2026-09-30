'use server';

import { redirect } from 'next/navigation';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { hasActiveAccess } from '@/lib/subscriptions/access';
import { createSubscriptionCheckout } from '@/lib/payments/asaas/checkout';
import { cancelAtPeriodEnd } from '@/lib/payments/asaas/subscription';
import { getPaymentProvider } from '@/lib/payments';
import { captureAccountEvent } from '@/lib/analytics/server';

type CheckoutClaim =
  | { status: 'already_active' }
  | { status: 'ready'; localId: string; cancelSubscriptionId?: string };

/**
 * RS4 — reserva a linha de checkout sob o MESMO lock de usuário usado por
 * `activateTrial`. Sem isso, ativar o trial e abrir o checkout pago em
 * requisições concorrentes passariam ambos pelo pré-cheque e o usuário ficaria
 * com trial e cobrança pendentes. O lock serializa os dois caminhos.
 */
async function claimCheckoutSlot(userId: string): Promise<CheckoutClaim> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${userId} FOR UPDATE`);

    const now = new Date();
    const live = await tx.query.subscriptions.findMany({
      where: and(
        eq(schema.subscriptions.userId, userId),
        inArray(schema.subscriptions.status, ['active', 'past_due'])
      ),
    });
    const active = live.some((sub) =>
      sub.status === 'active'
        ? Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd > now)
        : Boolean(sub.graceUntil && sub.graceUntil > now)
    );
    if (active) return { status: 'already_active' };

    const resetForNewCheckout = {
      status: 'incomplete',
      asaasCheckoutId: null,
      asaasSubscriptionId: null,
      providerId: null,
    };

    const existing = await tx.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.packId, 'unlimited'),
        eq(schema.subscriptions.provider, 'asaas')
      ),
    });
    if (existing) {
      const cancelSubscriptionId =
        existing.asaasSubscriptionId &&
        existing.asaasStatus !== 'INACTIVE' &&
        existing.asaasStatus !== 'DELETED'
          ? existing.asaasSubscriptionId
          : undefined;
      await tx
        .update(schema.subscriptions)
        .set(resetForNewCheckout)
        .where(eq(schema.subscriptions.id, existing.id));
      return { status: 'ready', localId: existing.id, cancelSubscriptionId };
    }

    // ON CONFLICT evita abortar a transação (o catch de 23505 não funciona
    // dentro de tx: o Postgres marca a transação como falha).
    const [created] = await tx
      .insert(schema.subscriptions)
      .values({
        userId,
        packId: 'unlimited',
        provider: 'asaas',
        status: 'incomplete',
        cycle: 'YEARLY',
        billingType: 'CREDIT_CARD',
      })
      .onConflictDoNothing()
      .returning({ id: schema.subscriptions.id });
    if (created) return { status: 'ready', localId: created.id };

    const winner = await tx.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.packId, 'unlimited'),
        eq(schema.subscriptions.provider, 'asaas')
      ),
    });
    if (!winner) throw new Error('assinatura não reservada');
    return { status: 'ready', localId: winner.id };
  });
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

  const claimed = await claimCheckoutSlot(userId);
  if (claimed.status === 'already_active') redirect('/perfil');

  // I4 — recompra com assinatura Asaas ainda ativa pode continuar cobrando.
  // Inativa a antiga ANTES de abrir o novo checkout (fora da transação: é rede).
  if (claimed.cancelSubscriptionId) {
    try {
      await cancelAtPeriodEnd(claimed.cancelSubscriptionId);
    } catch (e) {
      console.warn(
        `[assinar] falha ao inativar assinatura ${claimed.cancelSubscriptionId}: ${String(e)}`
      );
    }
  }
  const localId = claimed.localId;

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
