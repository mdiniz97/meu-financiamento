'use server';

import { redirect } from 'next/navigation';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { hasActiveAccess } from '@/lib/subscriptions/access';
import { createSubscriptionCheckout } from '@/lib/payments/asaas/checkout';
import { cancelAtPeriodEnd } from '@/lib/payments/asaas/subscription';
import { addCycle } from '@/lib/subscriptions/cycle';
import { captureAccountEvent } from '@/lib/analytics/server';
import { requireBillingCycle, subscriptionPrice, type BillingCycle } from '@/lib/subscriptions/plans';

type CheckoutClaim =
  | { status: 'already_active' }
  | { status: 'pending' }
  | { status: 'reuse'; link: string }
  | { status: 'ready'; localId: string; cancelSubscriptionId?: string };

/**
 * RS4 — reserva a linha de checkout sob o MESMO lock de usuário usado por
 * `activateTrial`. Sem isso, ativar o trial e abrir o checkout pago em
 * requisições concorrentes passariam ambos pelo pré-cheque e o usuário ficaria
 * com trial e cobrança pendentes. O lock serializa os dois caminhos.
 */
async function claimCheckoutSlot(userId: string, cycle: BillingCycle, priceCents: number, provider: string): Promise<CheckoutClaim> {
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
      asaasCheckoutLink: null,
      checkoutStartedAt: new Date(),
      cycle,
      contractedPriceCents: priceCents,
    };

    const existing = await tx.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.packId, 'unlimited'),
        eq(schema.subscriptions.provider, provider)
      ),
    });
    if (existing) {
      if (existing.status === 'incomplete' && (existing.checkoutStartedAt || existing.asaasCheckoutId)) {
        if (existing.cycle === cycle && existing.asaasCheckoutLink) {
          return { status: 'reuse', link: existing.asaasCheckoutLink };
        }
        return { status: 'pending' };
      }
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
        provider,
        status: 'incomplete',
        cycle,
        contractedPriceCents: priceCents,
        checkoutStartedAt: new Date(),
        billingType: 'CREDIT_CARD',
      })
      .onConflictDoNothing()
      .returning({ id: schema.subscriptions.id });
    if (created) return { status: 'ready', localId: created.id };

    const winner = await tx.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.packId, 'unlimited'),
        eq(schema.subscriptions.provider, provider)
      ),
    });
    if (!winner) throw new Error('assinatura não reservada');
    return { status: 'pending' };
  });
}

export async function startSubscription(selectedCycle: BillingCycle = 'YEARLY'): Promise<void> {
  const cycle = requireBillingCycle(selectedCycle);
  const session = await auth();
  if (!session?.userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/assinar?cycle=${cycle}`)}`);
  const userId = session.userId;

  if (await hasActiveAccess(userId)) redirect('/perfil');

  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, 'unlimited'),
  });
  if (!pack) redirect('/perfil');
  const priceCents = subscriptionPrice(pack, cycle);
  const provider = process.env.PAYMENT_PROVIDER ?? 'fake';
  if (provider === 'fake' && process.env.NODE_ENV === 'production') {
    throw new Error('PAYMENT_PROVIDER=fake não é permitido em produção');
  }
  const claimed = await claimCheckoutSlot(userId, cycle, priceCents, provider);
  if (claimed.status === 'already_active') redirect('/perfil');
  if (claimed.status === 'pending') redirect('/assinar?pending=1');
  if (claimed.status === 'reuse') redirect(claimed.link);

  // Fake approval stays server-side; redirecting a server action through a GET
  // handler renders the destination but leaves the webhook URL in the router.
  if (provider === 'fake') {
    await db.update(schema.subscriptions).set({
      providerId: `fake_${userId}_unlimited`,
      status: 'active',
      currentPeriodEnd: addCycle(new Date(), cycle),
    }).where(and(
      eq(schema.subscriptions.id, claimed.localId),
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.provider, 'fake'),
      eq(schema.subscriptions.status, 'incomplete')
    ));
    redirect('/perfil');
  }

  // I4 — recompra com assinatura Asaas ainda ativa pode continuar cobrando.
  // Inativa a antiga ANTES de abrir o novo checkout (fora da transação: é rede).
  if (claimed.cancelSubscriptionId) {
    try {
      await cancelAtPeriodEnd(claimed.cancelSubscriptionId);
    } catch (e) {
      console.warn(
        `[assinar] falha ao inativar assinatura ${claimed.cancelSubscriptionId}: ${String(e)}`
      );
      throw e;
    }
  }
  const localId = claimed.localId;

  // APP_URL lido em runtime (não no topo do módulo): evita congelar o valor
  // antigo quando .env.local muda; trim da barra final evita `//assinar`.
  const appUrl = (process.env.APP_URL ?? 'http://localhost:3012').replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const checkout = await createSubscriptionCheckout({
    externalReference: localId,
    valueCents: priceCents,
    cycle,
    nextDueDate: today,
    successUrl: `${appUrl}/assinar/sucesso`,
    cancelUrl: `${appUrl}/perfil`,
    expiredUrl: `${appUrl}/perfil`,
  });

  await db
    .update(schema.subscriptions)
    .set({ asaasCheckoutId: checkout.id, asaasCheckoutLink: checkout.link })
    .where(eq(schema.subscriptions.id, localId));

  await captureAccountEvent(userId, 'checkout_started', checkout.id);
  redirect(checkout.link);
}
