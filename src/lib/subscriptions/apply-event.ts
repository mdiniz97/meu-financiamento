import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { addCredits } from '@/lib/credits';
import { isInvoiceEnabled } from '@/lib/payments/asaas/invoice-config';
import { configureInvoiceSettings, getFiscalInfo } from '@/lib/payments/asaas/subscription';
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
  checkoutSession?: string | null;
  externalReference?: string | null;
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
  status?: string;
}

interface AsaasInvoice {
  id: string;
  status?: string;
  number?: string | null;
  value?: number | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  effectiveDate?: string | null;
  subscription?: string | null;
}

interface AsaasEvent {
  id: string;
  event: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
  checkout?: AsaasCheckout;
  invoice?: AsaasInvoice;
}

type SubscriptionRow = Awaited<ReturnType<typeof db.query.subscriptions.findFirst>>;
type CreditPurchaseRow = Awaited<ReturnType<typeof db.query.creditPurchases.findFirst>>;

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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findSubscription(event: AsaasEvent): Promise<SubscriptionRow | null> {
  const providerKey =
    event.payment?.subscription ?? event.subscription?.id ?? event.invoice?.subscription;
  if (providerKey) {
    const found = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.providerId, providerKey),
    });
    if (found) return found;
  }

  const checkoutKey =
    event.subscription?.checkoutSession ??
    event.checkout?.id ??
    event.payment?.checkoutSession;
  if (checkoutKey) {
    const found = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.asaasCheckoutId, checkoutKey),
    });
    if (found) return found;
  }

  const externalReference =
    event.checkout?.externalReference ?? event.subscription?.externalReference;
  // Só consulta `id` (uuid) se o externalReference for um UUID. Um valor
  // estranho (checkout de outra integração, payload de debug) faria o Postgres
  // lançar `invalid input syntax for type uuid` e derrubar o evento.
  if (externalReference && UUID_RE.test(externalReference)) {
    const found = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.id, externalReference),
    });
    if (found) return found;
  }

  return null;
}

function isUniqueViolation(e: unknown): boolean {
  // Drizzle aninha o erro do pg em `cause`; percorre a cadeia até achar o code.
  let err = e as { code?: unknown; cause?: unknown } | null;
  while (err && typeof err.code === 'undefined' && err.cause) {
    err = err.cause as { code?: unknown; cause?: unknown } | null;
  }
  return err?.code === '23505';
}

/**
 * RA — compras DETACHED correlacionam por `checkoutSession`/`checkout.id`
 * (asaasCheckoutId) ou pelo `externalReference` (id local, quando UUID).
 */
async function findCreditPurchase(event: AsaasEvent): Promise<CreditPurchaseRow | null> {
  const checkoutKey = event.checkout?.id ?? event.payment?.checkoutSession;
  if (checkoutKey) {
    const found = await db.query.creditPurchases.findFirst({
      where: eq(schema.creditPurchases.asaasCheckoutId, checkoutKey),
    });
    if (found) return found;
  }

  const externalReference =
    event.checkout?.externalReference ?? event.payment?.externalReference;
  if (externalReference && UUID_RE.test(externalReference)) {
    const found = await db.query.creditPurchases.findFirst({
      where: eq(schema.creditPurchases.id, externalReference),
    });
    if (found) return found;
  }

  return null;
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepClone(item)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepClone(v);
    }
    return out as T;
  }
  return value;
}

const SENSITIVE_PAYMENT_KEY = /cvv|cvc|creditcardtoken/i;

/**
 * §11 — nunca persistir dados completos de cartão (PAN/CVV/token), nem cifrados.
 * Mantém apenas o número mascarado (últimos 4) e a bandeira. Retorna cópia
 * profunda para não mutar o evento recebido. Task 6 reusa para sanitizar o
 * `webhook_events.payload`.
 */
export function sanitizeEventForStorage<T>(event: T): T {
  const clone = deepClone(event) as Record<string, unknown>;

  // LGPD: o checkout traz `customerData` com CPF/telefone/endereço. Não usamos
  // esses campos em nenhum processamento (a correlação é por id/checkoutSession),
  // então removemos antes de persistir `webhook_events.payload`.
  const checkout = clone.checkout;
  if (checkout && typeof checkout === 'object') {
    delete (checkout as Record<string, unknown>).customerData;
  }

  const payment = clone.payment;
  if (!payment || typeof payment !== 'object') return clone as T;

  const pay = payment as Record<string, unknown>;
  for (const key of Object.keys(pay)) {
    if (SENSITIVE_PAYMENT_KEY.test(key)) delete pay[key];
  }

  const rawCard = pay.creditCard;
  if (rawCard && typeof rawCard === 'object') {
    const card = rawCard as Record<string, unknown>;
    const number = card.creditCardNumber;
    pay.creditCard = {
      creditCardNumber:
        typeof number === 'string' && number.length >= 4 ? `****${number.slice(-4)}` : '****',
      creditCardBrand: card.creditCardBrand ?? null,
    };
  }

  return clone as T;
}

/**
 * R2 — `user_id` é NOT NULL: sem assinatura resolvida não há usuário válido,
 * então não inserimos a linha de payment (apenas registramos o aviso).
 * O índice único de `asaas_payment_id` é um UNIQUE INDEX, por isso o upsert
 * usa `target` de coluna (`onConflictDoUpdate`), nunca `ON CONFLICT ON CONSTRAINT`.
 * `user_id`/`subscription_id` só entram no INSERT; o UPDATE atualiza apenas os
 * campos mutáveis derivados do evento.
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

  const status = p.status ?? event.event.replace('PAYMENT_', '');
  const billingType = p.billingType ?? null;
  const dueDate = parseDate(p.dueDate);
  const valueCents = p.value != null ? Math.round(p.value * 100) : null;
  const netValueCents = p.netValue != null ? Math.round(p.netValue * 100) : null;
  const invoiceUrl = p.invoiceUrl ?? null;

  await db
    .insert(schema.payments)
    .values({
      asaasPaymentId: p.id,
      subscriptionId: subId,
      userId,
      status,
      billingType,
      dueDate,
      valueCents,
      netValueCents,
      invoiceUrl,
      confirmedAt: event.event === 'PAYMENT_CONFIRMED' ? new Date() : null,
      receivedAt: event.event === 'PAYMENT_RECEIVED' ? new Date() : null,
      rawLastEvent: sanitizeEventForStorage(event),
    })
    .onConflictDoUpdate({
      target: schema.payments.asaasPaymentId,
      set: {
        status,
        billingType,
        dueDate,
        valueCents,
        netValueCents,
        invoiceUrl,
        // Preserva o primeiro timestamp não-nulo (o INSERT traz o valor do evento).
        confirmedAt: sql`coalesce(${schema.payments.confirmedAt}, excluded.confirmed_at)`,
        receivedAt: sql`coalesce(${schema.payments.receivedAt}, excluded.received_at)`,
        rawLastEvent: sanitizeEventForStorage(event),
        updatedAt: new Date(),
      },
    });
}

/**
 * RB — créditos liberados com description estável (`pay_*`); o índice único
 * parcial (user_id, kind='purchase', description) barra reentrega duplicada.
 * Sem compra correlacionada, eventos de pagamento ainda passam pelo
 * `upsertPayment` para registrar o aviso e nunca lançar (R2).
 */
async function applyCreditPurchase(event: AsaasEvent): Promise<void> {
  const purchase = await findCreditPurchase(event);
  if (!purchase) {
    await upsertPayment(event, undefined, undefined);
    return;
  }

  switch (event.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      // Curto-circuito de reentrega: compra já paga não credita de novo. O
      // índice único (`isUniqueViolation`) segue como rede para entregas
      // concorrentes que leem `pending` antes de qualquer uma marcar `paid`.
      if (purchase.status === 'paid') return;
      const description = `Compra créditos (providerId ${event.payment?.id})`;
      try {
        await addCredits(purchase.userId, purchase.credits, 'purchase', description);
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
      await db
        .update(schema.creditPurchases)
        .set({
          status: 'paid',
          asaasPaymentId: event.payment?.id ?? null,
          paidAt: new Date(),
        })
        .where(eq(schema.creditPurchases.id, purchase.id));
      return;
    }

    case 'PAYMENT_CREATED': {
      if (purchase.status !== 'pending') return;
      console.log(
        `[apply-event] compra de créditos ${purchase.id} aguardando pagamento (${event.payment?.invoiceUrl ?? 'sem invoiceUrl'})`
      );
      return;
    }

    case 'CHECKOUT_EXPIRED':
    case 'CHECKOUT_CANCELED': {
      if (purchase.status !== 'pending') return;
      await db
        .update(schema.creditPurchases)
        .set({ status: event.event === 'CHECKOUT_EXPIRED' ? 'expired' : 'canceled' })
        .where(eq(schema.creditPurchases.id, purchase.id));
      return;
    }

    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_PARTIALLY_REFUNDED':
    case 'PAYMENT_CHARGEBACK_REQUESTED': {
      // Revoga só compra efetivamente paga; replay (já `refunded`) não passa do
      // guard e, portanto, não estorna créditos de novo.
      if (purchase.status !== 'paid') return;
      const description = `Estorno créditos (providerId ${event.payment?.id})`;
      try {
        await addCredits(purchase.userId, -purchase.credits, 'refund', description);
      } catch (e) {
        // Retry/race: o índice único parcial (kind IN 'purchase','refund')
        // garante que o segundo estorno não duplica o lançamento negativo.
        if (!isUniqueViolation(e)) throw e;
      }
      await db
        .update(schema.creditPurchases)
        .set({ status: 'refunded' })
        .where(eq(schema.creditPurchases.id, purchase.id));
      return;
    }

    default:
      return;
  }
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
  invoiceConfiguredAt?: Date;
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

const INVOICE_EVENTS = new Set([
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_SYNCHRONIZED',
  'INVOICE_AUTHORIZED',
  'INVOICE_PROCESSING_CANCELLATION',
  'INVOICE_CANCELED',
  'INVOICE_CANCELLATION_DENIED',
  'INVOICE_ERROR',
]);

/**
 * RD — eventos de NFS-e são gated: com a flag off nada é consultado nem
 * persistido. Correlaciona a assinatura por `invoice.subscription` (quando
 * existe) e faz upsert por `asaasInvoiceId`.
 */
async function applyInvoiceEvent(event: AsaasEvent): Promise<void> {
  if (!isInvoiceEnabled()) return;
  const invoice = event.invoice;
  if (!invoice?.id) return;

  const sub = await findSubscription(event);
  const status = invoice.status ?? event.event.replace('INVOICE_', '');
  const valueCents = invoice.value != null ? Math.round(invoice.value * 100) : null;
  const effectiveDate = parseDate(invoice.effectiveDate);
  const rawLastEvent = sanitizeEventForStorage(event);

  const set: Record<string, unknown> = {
    status,
    number: invoice.number ?? null,
    valueCents,
    pdfUrl: invoice.pdfUrl ?? null,
    xmlUrl: invoice.xmlUrl ?? null,
    effectiveDate,
    rawLastEvent,
    updatedAt: new Date(),
  };
  if (sub) {
    set.subscriptionId = sub.id;
    set.userId = sub.userId;
  }

  await db
    .insert(schema.invoices)
    .values({
      asaasInvoiceId: invoice.id,
      subscriptionId: sub?.id ?? null,
      userId: sub?.userId ?? null,
      status,
      number: invoice.number ?? null,
      valueCents,
      pdfUrl: invoice.pdfUrl ?? null,
      xmlUrl: invoice.xmlUrl ?? null,
      effectiveDate,
      rawLastEvent,
    })
    .onConflictDoUpdate({ target: schema.invoices.asaasInvoiceId, set });
}

/** Gancho gated de NFS-e: nunca derruba o processamento da assinatura. */
async function configureInvoiceIfEnabled(
  subId: string,
  asaasSubscriptionId: string
): Promise<void> {
  if (!isInvoiceEnabled()) return;
  try {
    const fiscal = await getFiscalInfo();
    if (!fiscal.ok) {
      console.warn(
        `[apply-event] conta sem configuração fiscal; NFS-e não configurada para ${asaasSubscriptionId}`
      );
      return;
    }
    await configureInvoiceSettings(asaasSubscriptionId);
    await patchSubscription(subId, { invoiceConfiguredAt: new Date() });
  } catch (e) {
    console.warn(`[apply-event] falha ao configurar NFS-e de ${asaasSubscriptionId}:`, e);
  }
}

export async function applyAsaasEvent(
  evt: { id: string; event: string } & Record<string, unknown>
): Promise<void> {
  const event = evt as unknown as AsaasEvent;
  if (INVOICE_EVENTS.has(event.event)) return applyInvoiceEvent(event);
  const sub = await findSubscription(event);
  // Sem assinatura correlacionada o evento pode ser de uma compra de créditos
  // avulsa (checkout DETACHED). Assinatura resolvida nunca concede créditos.
  if (!sub) return applyCreditPurchase(event);
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
      if (event.event === 'SUBSCRIPTION_CREATED') {
        await configureInvoiceIfEnabled(subId, s.id);
      }
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
