import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { addCycle } from './cycle';

const GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

interface AsaasPayment {
  id: string;
  subscription?: string | null;
  status?: string;
  billingType?: string;
  dueDate?: string | null;
  value?: number | null;
  netValue?: number | null;
  invoiceUrl?: string | null;
  creditCard?: { creditCardNumber?: string; creditCardBrand?: string };
}

interface AsaasSubscription {
  id: string;
  customer?: string;
  cycle?: string;
  value?: number;
  nextDueDate?: string | null;
  billingType?: string;
  status?: string;
  checkoutSession?: string | null;
  externalReference?: string | null;
}

interface AsaasCheckout {
  id?: string;
  externalReference?: string | null;
}

interface AsaasEvent {
  id: string;
  event: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
  checkout?: AsaasCheckout;
}

type SubscriptionRow = Awaited<ReturnType<typeof db.query.subscriptions.findFirst>>;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00Z`);
}

/**
 * R1 — correlação em ordem: providerId → asaasCheckoutId → id local (uuid).
 * `providerId` fica NULL até o SUBSCRIPTION_CREATED, por isso os primeiros
 * eventos (checkout) casam por `checkoutSession` e os PAYMENT_* seguintes
 * por `payment.subscription` (== providerId gravado).
 */
async function findSubscription(event: AsaasEvent): Promise<SubscriptionRow | null> {
  const providerKey = event.payment?.subscription ?? event.subscription?.id;
  if (providerKey) {
    const found = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.providerId, providerKey),
    });
    if (found) return found;
  }

  const checkoutKey = event.subscription?.checkoutSession ?? event.checkout?.id;
  if (checkoutKey) {
    const found = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.asaasCheckoutId, checkoutKey),
    });
    if (found) return found;
  }

  const externalReference =
    event.checkout?.externalReference ?? event.subscription?.externalReference;
  if (externalReference) {
    const found = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.id, externalReference),
    });
    if (found) return found;
  }

  return null;
}

/**
 * R2 — `user_id` é NOT NULL: sem assinatura resolvida não há usuário válido,
 * então não inserimos a linha de payment (apenas registramos o aviso).
 * O índice único de `asaas_payment_id` é um UNIQUE INDEX; usamos
 * `onConflictDoNothing()` sem target, nunca `ON CONFLICT ON CONSTRAINT`.
 */
async function upsertPayment(
  event: AsaasEvent,
  subId: string | undefined,
  userId: string | undefined
): Promise<void> {
  const p = event.payment;
  if (!p) return;
  if (!subId || !userId) {
    console.warn(
      `[apply-event] payment ${p.id} (${event.event}) sem assinatura/usuário resolvidos; ignorando`
    );
    return;
  }
  await db
    .insert(schema.payments)
    .values({
      asaasPaymentId: p.id,
      subscriptionId: subId,
      userId,
      status: p.status ?? event.event.replace('PAYMENT_', ''),
      billingType: p.billingType ?? null,
      dueDate: parseDate(p.dueDate),
      valueCents: p.value != null ? Math.round(p.value * 100) : null,
      netValueCents: p.netValue != null ? Math.round(p.netValue * 100) : null,
      invoiceUrl: p.invoiceUrl ?? null,
      confirmedAt: event.event === 'PAYMENT_CONFIRMED' ? new Date() : null,
      receivedAt: event.event === 'PAYMENT_RECEIVED' ? new Date() : null,
      rawLastEvent: event,
    })
    .onConflictDoNothing();
}

interface SubscriptionPatch {
  status?: string;
  providerId?: string;
  asaasSubscriptionId?: string;
  asaasCustomerId?: string;
  currentPeriodEnd?: Date;
  nextDueDate?: Date;
  graceUntil?: Date | null;
  asaasStatus?: string;
  billingType?: string;
  cycle?: string;
  cardLast4?: string;
  cardBrand?: string;
  canceledAt?: Date;
}

async function patchSubscription(subId: string, patch: SubscriptionPatch): Promise<void> {
  await db
    .update(schema.subscriptions)
    .set(patch)
    .where(eq(schema.subscriptions.id, subId));
}

/**
 * §7.2 — renovação ESTENDE, nunca encolhe período já pago.
 */
function extendedPeriodEnd(
  existing: Date | null,
  dueDate: Date,
  cycle: string
): Date {
  const candidate = addCycle(dueDate, cycle);
  if (existing && existing.getTime() > candidate.getTime()) return existing;
  return candidate;
}

export async function applyAsaasEvent(
  evt: { id: string; event: string } & Record<string, unknown>
): Promise<void> {
  const event = evt as unknown as AsaasEvent;
  const sub = await findSubscription(event);
  const subId = sub?.id ?? undefined;

  switch (event.event) {
    case 'CHECKOUT_PAID':
      // Correlaciona (findSubscription) mas nunca libera acesso.
      return;

    case 'CHECKOUT_CANCELED':
    case 'CHECKOUT_EXPIRED': {
      // §6: incomplete → canceled. Não cancela assinatura já ativa.
      if (!sub || sub.status !== 'incomplete') return;
      await patchSubscription(sub.id, { status: 'canceled' });
      return;
    }

    case 'SUBSCRIPTION_CREATED':
    case 'SUBSCRIPTION_UPDATED': {
      const s = event.subscription;
      if (!subId || !s) return;
      await patchSubscription(subId, {
        providerId: s.id,
        asaasSubscriptionId: s.id,
        asaasCustomerId: s.customer ?? undefined,
        cycle: s.cycle ?? undefined,
        billingType: s.billingType ?? undefined,
        nextDueDate: parseDate(s.nextDueDate) ?? undefined,
        asaasStatus: event.event === 'SUBSCRIPTION_CREATED' ? 'ACTIVE' : (s.status ?? undefined),
      });
      return;
    }

    case 'SUBSCRIPTION_INACTIVATED': {
      if (!subId) return;
      await patchSubscription(subId, { asaasStatus: 'INACTIVE' });
      return;
    }

    case 'SUBSCRIPTION_DELETED': {
      if (!subId) return;
      await patchSubscription(subId, {
        asaasStatus: 'DELETED',
        status: 'canceled',
        canceledAt: new Date(),
      });
      return;
    }

    case 'PAYMENT_CREATED':
    case 'PAYMENT_UPDATED':
    case 'PAYMENT_DELETED': {
      await upsertPayment(event, subId, sub?.userId);
      return;
    }

    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      await upsertPayment(event, subId, sub?.userId);
      if (!subId || !sub) return;
      const dueDate = parseDate(event.payment?.dueDate) ?? sub.nextDueDate ?? new Date();
      const cycle = sub.cycle ?? 'YEARLY';
      const currentPeriodEnd = extendedPeriodEnd(sub.currentPeriodEnd, dueDate, cycle);
      await patchSubscription(subId, {
        status: 'active',
        currentPeriodEnd,
        nextDueDate: currentPeriodEnd,
        graceUntil: null,
        asaasStatus: 'ACTIVE',
        cardLast4: event.payment?.creditCard?.creditCardNumber?.slice(-4) ?? undefined,
        cardBrand: event.payment?.creditCard?.creditCardBrand ?? undefined,
      });
      return;
    }

    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
    case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS': {
      await upsertPayment(event, subId, sub?.userId);
      if (!subId) return;
      await patchSubscription(subId, {
        status: 'past_due',
        graceUntil: new Date(Date.now() + GRACE_DAYS * DAY_MS),
      });
      return;
    }

    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_CHARGEBACK_REQUESTED': {
      await upsertPayment(event, subId, sub?.userId);
      if (!subId) return;
      if (event.event === 'PAYMENT_CHARGEBACK_REQUESTED') {
        console.warn(`[apply-event] chargeback solicitado para a assinatura ${subId}`);
      }
      // REFUNDED total e CHARGEBACK revogam acesso; PARTIALLY_REFUNDED não.
      await patchSubscription(subId, { status: 'canceled', canceledAt: new Date() });
      return;
    }

    case 'PAYMENT_PARTIALLY_REFUNDED': {
      await upsertPayment(event, subId, sub?.userId);
      return;
    }

    default:
      return;
  }
}

export async function processWebhookEvent(eventRowId: string): Promise<void> {
  const row = await db.query.webhookEvents.findFirst({
    where: eq(schema.webhookEvents.id, eventRowId),
  });
  if (!row || row.processedAt) return;

  try {
    await applyAsaasEvent(row.payload as { id: string; event: string } & Record<string, unknown>);
    await db
      .update(schema.webhookEvents)
      .set({ processedAt: new Date(), lastError: null })
      .where(eq(schema.webhookEvents.id, eventRowId));
  } catch (e) {
    await db
      .update(schema.webhookEvents)
      .set({ attempts: (row.attempts ?? 0) + 1, lastError: String(e) })
      .where(eq(schema.webhookEvents.id, eventRowId));
    throw e;
  }
}
