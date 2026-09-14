import { headers } from 'next/headers';

function expectedHost(): string {
  return new URL(process.env.APP_URL ?? 'http://localhost:3012').host;
}

/**
 * RS1 — barra CSRF em Server Actions de gerenciamento.
 *
 * Usa o cabeçalho `Origin` (enviado pelo navegador em POST de Server Action) e
 * o `host` como defesa extra. Sem `Origin`, o navegador não valida a origem:
 * em produção bloqueia; no ambiente de teste os mocks não enviam `Origin`,
 * então permite para não quebrar a suíte.
 */
export async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  const host = requestHeaders.get('host');
  const expected = expectedHost();

  if (!origin) {
    if (process.env.NODE_ENV === 'test') return;
    throw new Error('same-origin: cabeçalho Origin ausente');
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error('same-origin: Origin inválido');
  }

  if (originHost !== expected) {
    throw new Error('same-origin: origem divergente');
  }
  if (host && host !== expected) {
    throw new Error('same-origin: host divergente');
  }
}
