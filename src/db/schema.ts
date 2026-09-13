import { pgTable, text, integer, uuid, boolean, timestamp, jsonb, doublePrecision, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const packs = pgTable('packs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  credits: integer('credits'),
  isSubscription: boolean('is_subscription').notNull().default(false),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    packId: text('pack_id')
      .notNull()
      .references(() => packs.id),
    provider: text('provider').notNull(),
    providerId: text('provider_id'),
    status: text('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    asaasCustomerId: text('asaas_customer_id'),
    asaasSubscriptionId: text('asaas_subscription_id'),
    asaasCheckoutId: text('asaas_checkout_id'),
    billingType: text('billing_type'),
    cycle: text('cycle'),
    nextDueDate: timestamp('next_due_date', { withTimezone: true }),
    asaasStatus: text('asaas_status'),
    cardLast4: text('card_last4'),
    cardBrand: text('card_brand'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    graceUntil: timestamp('grace_until', { withTimezone: true }),
    invoiceConfiguredAt: timestamp('invoice_configured_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('subscriptions_provider_id_unique')
      .on(table.providerId)
      .where(sql`${table.providerId} IS NOT NULL`),
    uniqueIndex('subscriptions_asaas_subscription_id_unique')
      .on(table.asaasSubscriptionId)
      .where(sql`${table.asaasSubscriptionId} IS NOT NULL`),
    // Primeira compra: uma única assinatura por (usuário, pacote, provedor);
    // renovações estendem a MESMA linha. Sem esse índice, dois webhooks reais
    // em paralelo com providerIds distintos inseririam duas linhas e a segunda
    // compra perderia os 30 dias (o providerId distinto não colide no índice
    // parcial acima). O 23505 desse índice dispara re-leitura + extensão.
    uniqueIndex('subscriptions_user_pack_provider_unique')
      .on(table.userId, table.packId, table.provider),
  ]
);

export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    kind: text('kind').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    // Idempotência de compras e estornos: cada providerId gera description única,
    // então re-compras legítimas não colidem. O mesmo índice cobre refunds para
    // que retry/race não insira lançamento negativo duplicado. Bonus ('Bônus de
    // boas-vindas', kind 'bonus') e gastos (kind 'spend', descrições repetidas
    // entre saves) ficam fora do índice por causa do WHERE kind IN (...).
    uniqueIndex('credit_ledger_user_kind_description_unique')
      .on(table.userId, table.kind, table.description)
      .where(sql`${table.kind} IN ('purchase', 'refund')`),
  ]
);

export const simulations = pgTable('simulations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  payload: jsonb('payload').notNull(),
  result: jsonb('result').notNull(),
  system: text('system').notNull(),
  creditsSpent: integer('credits_spent').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const proposalComparisons = pgTable('proposal_comparisons', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  monthlyBudget: doublePrecision('monthly_budget').notNull(),
  proposals: jsonb('proposals').notNull(),
  result: jsonb('result').notNull(),
  // Default 1 identifies historical/unversioned rows; runtime writes COMPARISON_ENGINE_VERSION.
  engineVersion: text('engine_version').notNull().default('1'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bank: text('bank').notNull(),
  system: text('system').notNull(), // 'PRICE' | 'SAC'
  annualRate: doublePrecision('annual_rate').notNull(), // efetiva a.a. (0..1)
  trMonthly: doublePrecision('tr_monthly').notNull(), // 0..0.1
  insuranceMonthly: doublePrecision('insurance_monthly').notNull(),
  parcelasTotais: integer('parcelas_totais').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [uniqueIndex('contracts_user_id_unique').on(table.userId)]);

export const contractStates = pgTable('contract_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => contracts.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  saldoDevedor: doublePrecision('saldo_devedor').notNull(),
  dataBase: text('data_base').notNull(), // 'YYYY-MM-DD'
  proximaParcelaNumero: integer('proxima_parcela_numero').notNull(), // 1..parcelasTotais
  diaVencimento: integer('dia_vencimento').notNull(), // 1..31 (clamp no mês sem o dia)
  source: text('source').notNull(), // 'cadastro' | 'recalibracao' | 'quitacao' | 'atualizacao'
  // Parâmetros contratuais versionados: portabilidade/mudança de taxa ou
  // sistema grava uma versão nova e congela o passado (movements do estado
  // antigo não são reaplicados). `contracts` mantém o cadastro original como
  // metadado.
  bank: text('bank').notNull(),
  system: text('system').notNull(), // 'PRICE' | 'SAC'
  annualRate: doublePrecision('annual_rate').notNull(), // efetiva a.a. (0..1)
  trMonthly: doublePrecision('tr_monthly').notNull(), // 0..0.1
  insuranceMonthly: doublePrecision('insurance_monthly').notNull(),
  parcelasTotais: integer('parcelas_totais').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('contract_states_contract_version_unique').on(table.contractId, table.version),
]);

export const movements = pgTable('movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => contracts.id, { onDelete: 'cascade' }),
  stateId: uuid('state_id')
    .notNull()
    .references(() => contractStates.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'parcela' | 'amortizacao'
  parcelaNumero: integer('parcela_numero'), // type=parcela: obrigatório; type=amortizacao: null
  valor: doublePrecision('valor').notNull(),
  dataPagamento: text('data_pagamento').notNull(), // 'YYYY-MM-DD'
  origem: text('origem'), // 'proprio' | 'fgts' (só amortizacao)
  modo: text('modo'), // 'term' | 'payment' (só amortizacao)
  // Vincula parcela + amortização do excedente do mesmo pagamento (sem FK):
  // apagar a parcela apaga o grupo inteiro.
  groupId: uuid('group_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('movements_contract_parcela_unique')
    .on(table.contractId, table.parcelaNumero)
    .where(sql`${table.type} = 'parcela' AND ${table.parcelaNumero} IS NOT NULL`),
]);

export const contractDrafts = pgTable('contract_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [uniqueIndex('contract_drafts_user_id_unique').on(table.userId)]);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    asaasPaymentId: text('asaas_payment_id').notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    billingType: text('billing_type'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    valueCents: integer('value_cents'),
    netValueCents: integer('net_value_cents'),
    invoiceUrl: text('invoice_url'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    rawLastEvent: jsonb('raw_last_event'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payments_asaas_payment_id_unique').on(table.asaasPaymentId),
    index('payments_subscription_id_idx').on(table.subscriptionId),
    index('payments_status_idx').on(table.status),
  ]
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    asaasEventId: text('asaas_event_id').notNull().unique(),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (table) => [index('webhook_events_event_idx').on(table.event)]
);

export const creditPurchases = pgTable(
  'credit_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    packId: text('pack_id').notNull().references(() => packs.id),
    provider: text('provider').notNull(),
    asaasCheckoutId: text('asaas_checkout_id'),
    asaasPaymentId: text('asaas_payment_id'),
    status: text('status').notNull().default('pending'),
    credits: integer('credits').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('credit_purchases_asaas_checkout_id_unique')
      .on(table.asaasCheckoutId)
      .where(sql`${table.asaasCheckoutId} IS NOT NULL`),
    index('credit_purchases_user_id_idx').on(table.userId),
  ]
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    asaasInvoiceId: text('asaas_invoice_id').notNull().unique(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    number: text('number'),
    valueCents: integer('value_cents'),
    pdfUrl: text('pdf_url'),
    xmlUrl: text('xml_url'),
    asaasPaymentId: text('asaas_payment_id'),
    effectiveDate: timestamp('effective_date', { withTimezone: true }),
    rawLastEvent: jsonb('raw_last_event'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('invoices_subscription_id_idx').on(table.subscriptionId),
    index('invoices_asaas_payment_id_idx').on(table.asaasPaymentId),
  ]
);

export type CreditPurchase = typeof creditPurchases.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Pack = typeof packs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type Simulation = typeof simulations.$inferSelect;
export type ProposalComparison = typeof proposalComparisons.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractState = typeof contractStates.$inferSelect;
export type Movement = typeof movements.$inferSelect;
export type ContractDraft = typeof contractDrafts.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
