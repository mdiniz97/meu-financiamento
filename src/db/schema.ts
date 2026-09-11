import { pgTable, text, integer, uuid, boolean, timestamp, jsonb, doublePrecision, uniqueIndex } from 'drizzle-orm/pg-core';
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
  },
  (table) => [
    uniqueIndex('subscriptions_provider_id_unique')
      .on(table.providerId)
      .where(sql`${table.providerId} IS NOT NULL`),
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
    // Idempotência de compras: cada providerId gera description única, então
    // re-compras legítimas não colidem. Bonus ('Bônus de boas-vindas', kind
    // 'bonus') e gastos (kind 'spend', descrições repetidas entre saves) ficam
    // fora do índice por causa do WHERE kind = 'purchase'.
    uniqueIndex('credit_ledger_user_kind_description_unique')
      .on(table.userId, table.kind, table.description)
      .where(sql`${table.kind} = 'purchase'`),
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
  insuranceSplit: jsonb('insurance_split').notNull(),
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
