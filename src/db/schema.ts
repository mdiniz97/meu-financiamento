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
  // Keep migration default aligned manually; runtime writes COMPARISON_ENGINE_VERSION.
  engineVersion: text('engine_version').notNull().default('1'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Pack = typeof packs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type Simulation = typeof simulations.$inferSelect;
export type ProposalComparison = typeof proposalComparisons.$inferSelect;
