import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Migrações (DDL) devem usar a conexão DIRETA do Neon; o app em runtime usa a
  // POOLED (`DATABASE_URL`). Em ambientes sem `DATABASE_URL_UNPOOLED` (local/CI)
  // cai de volta para `DATABASE_URL`.
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5433/financiamento',
  },
});
