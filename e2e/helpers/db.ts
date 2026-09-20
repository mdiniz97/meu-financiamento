import { execSync } from 'node:child_process';

/**
 * URL do Postgres usada pelos helpers de e2e que consultam o banco via `psql`.
 *
 * O CI sobe o Postgres como service container na porta **5432** e exporta
 * `DATABASE_URL`; o docker-compose local usa a **5433**. Hardcodar a 5433 nas
 * specs fazia todo teste que precisa de usuário real falhar no CI com
 * `connection refused`, enquanto os testes de página pública passavam.
 */
export const DB_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/financiamento';

/** `true` quando o binário `psql` existe no PATH (specs que dependem dele usam `test.skip`). */
export const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
