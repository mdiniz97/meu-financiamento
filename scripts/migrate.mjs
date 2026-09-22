// Migrador de produção (release/pre-deploy do Railway).
//
// Usa `drizzle-orm/node-postgres/migrator` (já presente no runtime standalone),
// então não depende do `drizzle-kit` nem de devDependencies na imagem final.
//
// Prefere a conexão DIRETA do Neon (`DATABASE_URL_UNPOOLED`) — DDL via pooler é
// problemático. Cai para `DATABASE_URL` quando a unpooled não existe (local/CI).

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { seedPacks } from './seed-packs.mjs';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL_UNPOOLED/DATABASE_URL ausente; abortando');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: 'drizzle' });
  await seedPacks(pool);
  console.log('[migrate] migrações aplicadas com sucesso');
} finally {
  await pool.end();
}
